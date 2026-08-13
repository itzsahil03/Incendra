# common

Shared library for the IncidentOps platform — not a runnable service (there is no
`@SpringBootApplication` class here, and it's packaged as a plain `jar`, not
`spring-boot-maven-plugin`-repackaged). Every one of the platform's domain services
and infrastructure services depends on it. Rather than each service manually wiring up
cross-cutting behavior (request logging, audit trail publication, JWT parsing, uniform
error responses), `common` registers most of it automatically via Spring Boot's
auto-configuration mechanism (`META-INF/spring/...AutoConfiguration.imports`), so a
service gets it "for free" the moment it adds the `common` dependency — no
component-scan changes, no manual `@Import`, no per-service `@Bean` boilerplate for
the shared pieces.

## What's in it

### `events/`

- **`DomainEvent`** — the base Kafka envelope every topic in the platform uses:
  `eventId`, `topic`, `orgId`, `ts`, `payload` (a generic `Map<String, Object>`).
  Every producer builds one via `DomainEvent.of(topic, orgId, payload)`.
- **`Topics`** — a single source of truth for topic name string constants
  (`ALERT_RECEIVED`, `INCIDENT_CREATED`, `AUDIT_EVENT`, etc.) so no service hardcodes
  a topic name that could typo-drift from what another service's `@KafkaListener`
  expects.
- **`AuditEvent`** — the payload shape specifically for the `AuditEvent` topic
  (`auditId`, `service`, `action`, `entityType`, `entityId`, `orgId`, `actorId`,
  `occurredAt`, `details`), built by `AuditPublisher` and consumed by
  `auditor-service`.

These three are shared rather than duplicated per service because every producer and
every consumer of a given topic must agree byte-for-byte on both the topic name and
the payload shape — see `common/EVENTS.md` for the full topic-by-topic producer/
consumer/payload table and the idempotency and multi-tenant-isolation conventions;
this README does not repeat it.

### `security/`

- **`JwtUtil`** — signs and parses JWTs with a single shared HMAC secret
  (`io.jsonwebtoken`/jjwt). Every service that validates or issues a token uses the
  same secret and the same claim shape (`subject` = user id, `org` claim, `role`
  claim), which is what lets a token minted by `auth-service` — or re-minted by
  `api-gateway`, see below — be validated independently by every other service.
  `issue(...)` has three overloads (4-arg, 5-arg-with-`scopes`, and a 6-arg form that
  additionally takes a `sid`), all funneling into the 6-arg one — the shorter overloads
  just default `scopes` to `List.of()` and `sid` to `null`. Only auth-service's
  real, user-facing session-issuing endpoints (login, register, refresh, switchOrg,
  acceptInvitation, createOrgForExistingUser, leaveOrganization) populate `sid`, each
  pairing it with a `session:<sid>` Redis record (see `SessionKeys` below) so
  `api-gateway` can check revocation on every request; the gateway's own per-request
  internal-token reissue deliberately omits it (that token is a short-lived
  downstream-only credential, not a session in its own right), and so does every
  client_credentials/service token.
- **`SessionKeys`** — the two Redis key-naming conventions shared between auth-service
  (which writes: mints a session record alongside every real access token it issues via
  the `sid`-carrying `JwtUtil.issue` overload above, deletes/updates one on revocation)
  and `api-gateway` (which only reads: checks `session(sid)` on every authenticated
  request before forwarding it downstream). `session(sid)` → `"session:" + sid` (value
  is the session's orgId; presence = active, absence = revoked/expired).
  `userSessions(userId)` → `"user-sessions:" + userId` (a Redis SET of every non-revoked
  sid issued to that user — the secondary index that makes "revoke every session for
  this user" possible without a Redis `SCAN`). Deliberately just string naming, no I/O:
  auth-service uses a blocking `StringRedisTemplate`, the gateway a reactive
  `ReactiveStringRedisTemplate` — two incompatible client types that can't share an
  implementation, only the key format both must agree on.
- **`HmacVerifier`** — constant-time HMAC-SHA256 signature verification for signed
  webhook payloads. Used by `alert-ingestion-service` to authenticate inbound
  monitoring-tool webhooks (Datadog/GitHub/custom) — a separate trust mechanism from
  OAuth, since a webhook sender never does an OAuth handshake (see root README §8).
- **`JwtAuthFilter`** — a servlet `OncePerRequestFilter` base class providing
  defense-in-depth JWT re-validation. `api-gateway` validates the caller's original
  OAuth token, then strips it and re-issues a fresh, short-lived internal token (same
  claims, much shorter TTL — see `api-gateway`'s README) alongside trusted
  `X-Org-Id`/`X-User-Id`/`X-Role` headers; each Spring MVC service independently
  re-validates whatever token it receives against the same `JwtUtil` secret, so a
  request that reached a service directly on the docker network (bypassing the
  gateway) is still rejected rather than trusted purely because someone attached the
  right-looking headers by hand. This re-validation works unmodified against the
  gateway-reissued token because every service trusts the shared secret, not any one
  specific token. Every Spring MVC service's own
  `security/JwtFilter.java` is a thin subclass of this — it isn't itself a
  `@Component`/`@Bean`, so each service still explicitly wires it into its own
  `SecurityConfig` and supplies its own list of public path prefixes to skip. On
  rejection it writes the `401` directly (`response.setStatus(...)` +
  `response.getWriter().write(...)`) rather than calling
  `HttpServletResponse.sendError(401, ...)` — this was a real, live-reproduced bug
  (not a style preference): `sendError` triggers Spring Boot's embedded-container
  error-page forward to `/error`, and that re-dispatch came back out as a bare `403`
  with an empty body on every service using this filter, not the `401` it actually
  asked for. `alert-ingestion-service`'s `HmacFilter` never had this bug — it already
  wrote its rejection directly for an unrelated reason — and that inconsistency
  (`401` documented everywhere, `403` actually observed) is what surfaced it during a
  live end-to-end verification pass. See `VERIFY.md`'s "Bugs found and fixed" section.

### `exception/`

- **`ErrorResponse`** — the uniform error body (`timestamp`, `status`, `error`,
  `message`, `path`) every service's `@RestControllerAdvice` returns, so API consumers
  see one consistent error shape platform-wide instead of one per service.
- **`ApiException`** — base class for domain exceptions (e.g. a hypothetical
  `UserNotFoundException`) that carry the `HttpStatus` they map to, so a service's
  exception handler doesn't need a `case` per exception subtype.
- **`BaseExceptionHandler`** — **not itself a `@ControllerAdvice`** (common's packages
  aren't component-scanned by any service, and each service needs its own advice bean
  anyway to also handle its own domain-specific exceptions). It supplies the shared
  response-building helpers (`build(...)`, `handleApiException(...)`); each service's
  own `exception/GlobalExceptionHandler.java` extends it and adds `@ExceptionHandler`
  methods for `ApiException` and any service-specific exception types on top. It also
  declares `handleUnexpected(Exception, WebRequest)` — the fallback `@ExceptionHandler`
  for anything not explicitly handled — directly on this base class rather than leaving
  each service to redeclare it: Spring's `ExceptionHandlerMethodResolver` scans a
  `@ControllerAdvice` bean's full class hierarchy, so an inherited `@ExceptionHandler`
  method is picked up automatically without a subclass override. This used to be
  duplicated verbatim in all ten services that had one, and every copy returned the raw
  `Exception.getMessage()` in the response body — fine for local debugging, but a real
  internal-detail leak (SQL fragments, library-specific wording) in anything closer to
  production. The shared version logs the real exception server-side and returns a
  generic `"Internal server error"` message to the caller. Alongside it,
  `BaseExceptionHandler` also declares `@ExceptionHandler`s for
  `HttpMessageNotReadableException` (malformed JSON body), `MissingRequestHeaderException`
  (a required `@RequestHeader` — almost every controller in this platform requires
  `X-Org-Id`/`X-User-Id`), `MissingServletRequestParameterException`,
  `MethodArgumentTypeMismatchException`, and `HttpRequestMethodNotSupportedException` —
  all mapped to `400`/`405` with a message naming the actual problem, instead of falling
  through to `handleUnexpected`'s generic `500`. A caller who forgot `X-Org-Id` used to
  get an opaque server-error response; now they get a `400` telling them which header is
  missing.

### `aspect/` + `audit/`

- **`Audited`** (annotation) — marks a method whose successful completion should
  produce an audit trail entry: `@Audited(action = "...", entityType = "...")`.
- **`AuditAspect`** — the `@Around` advice that actually implements it. It lets the
  method run, and only on success, reflects on the method's own parameter *names*
  (requires the `-parameters` javac flag, enabled repo-wide) to find attribution data:
  a parameter named exactly `orgId` becomes the tenant, and one named `userId` or
  `actorId` becomes the actor. A parameter named `id` is also opportunistically
  captured into the audit `details` map. This is a real, load-bearing limitation, not
  an edge case — see auditor-service's README "Known limitations" section for the
  concrete consequence (methods that don't expose those literal parameter names
  produce audit records with blank `orgId`/`actorId`). Publish failures are caught and
  logged, never rethrown, so a producing service's own request never fails because
  the audit side-channel failed.
- **`AuditPublisher`** — wraps a `KafkaTemplate<String, DomainEvent>` to build the
  `AuditEvent` payload and `DomainEvent` envelope and send it to `Topics.AUDIT_EVENT`,
  keyed by `orgId`, so no service hand-assembles that envelope itself.
- **`LoggingAspect`** — a second `@Around` advice, unconditionally registered for every
  `@RestController` and `@Service` bean in every consuming service, logging method
  entry/exit/args/timing/exceptions at `DEBUG`/`WARN` under the `io.incidentops.trace`
  logger — one implementation instead of the same boilerplate reimplemented in each of
  the platform's dozen services.

### `config/`

Two separate `@AutoConfiguration` classes, and the split between them is deliberate,
not incidental:

- **`CommonAutoConfiguration`** — registers `LoggingAspect` unconditionally (plus
  `@EnableAspectJAutoProxy`). Safe for every consumer, including ones with no Kafka at
  all (`api-gateway`, `discovery-server`, `config-server`), because it has no
  dependency on Kafka types.
- **`AuditAutoConfiguration`** — registers `AuditPublisher` and `AuditAspect`, but only
  when `KafkaTemplate` is both on the classpath (`@ConditionalOnClass`) and actually
  present as a bean (`@ConditionalOnBean`).
- **`KafkaErrorHandlingAutoConfiguration`** — registers a `DefaultErrorHandler` bean
  (same `@ConditionalOnClass(KafkaTemplate.class)` +
  `@AutoConfigureAfter(KafkaAutoConfiguration.class)` pattern as `AuditAutoConfiguration`,
  for the identical reasons) with a bounded `FixedBackOff` (3 retries, 1s apart) backed
  by a `DeadLetterPublishingRecoverer`. Spring Boot's own
  `ConcurrentKafkaListenerContainerFactoryConfigurer` applies any single
  `CommonErrorHandler` bean it finds to the auto-configured listener container factory,
  so every `@KafkaListener` in every consuming service gets this automatically — no
  per-service listener configuration needed. Before this existed, Spring Kafka's bare
  default behavior was to retry a failing record effectively indefinitely with no
  recovery, which blocks that partition for the whole consumer group until someone
  notices and restarts the service. This isn't a hypothetical: it's exactly the bug this
  project hit during its own end-to-end verification (chat-service's `ObjectMapper`
  serialization bug on `WorkflowTransition` — see chat-service's README and this
  project's `VERIFY.md`). With this in place, the same class of bug now degrades to "one
  message parked on `<topic>.DLT` for inspection" after 3 failed attempts, instead of
  "this consumer group stops making progress on this topic until the service is
  restarted."

**Why two files instead of one:** a `@ConditionalOnClass` on an individual `@Bean`
*method* only skips that bean — it does not stop Spring from reflectively inspecting
that method's full signature (including parameter types like `KafkaTemplate`) while
resolving other, unrelated conditions elsewhere in the context. In a service with no
`spring-kafka` on its classpath (e.g. `api-gateway`), that reflective inspection threw
`NoClassDefFoundError` for `KafkaTemplate` before this was split out — a class-level
`@ConditionalOnClass` on the *whole `AuditAutoConfiguration` class*, by contrast, is
evaluated via ASM bytecode scanning before the class is ever loaded, so it can skip the
class entirely and safely. This was a real bug that broke `api-gateway` startup, fixed
by moving the Kafka-dependent beans into their own class with a class-level condition.

**Why `@AutoConfigureAfter(KafkaAutoConfiguration.class)` is also required:**
`@ConditionalOnBean(KafkaTemplate.class)` only checks whether that bean exists *at the
point this configuration is evaluated* — Spring Boot does not guarantee
auto-configuration classes are processed in dependency order unless told to be. Without
the explicit `@AutoConfigureAfter`, `AuditAutoConfiguration` could be evaluated before
Spring Boot's own `KafkaAutoConfiguration` had created the `KafkaTemplate` bean, in
which case the condition would silently evaluate false — no `AuditPublisher`, no
`AuditAspect`, and therefore no audit events published anywhere, in every service,
with **zero errors or warnings anywhere**. This was a real, previously-shipped bug: the
entire audit trail silently produced nothing, and it was only caught by running the
full stack end-to-end and noticing `audit_events` stayed empty (see root README's
mention of `VERIFY.md`). Both of these issues are the reason the config is split and
ordered exactly as it is — a future reader collapsing them back into one class or
removing the ordering annotation would silently reintroduce one of these two bugs.

## Auto-configuration

`common/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
lists the two `@AutoConfiguration` classes above:

```
io.incidentops.common.config.CommonAutoConfiguration
io.incidentops.common.config.AuditAutoConfiguration
io.incidentops.common.config.KafkaErrorHandlingAutoConfiguration
```

This is the (post-Spring-Boot-2.7) replacement for the old
`spring.factories`-based auto-configuration registration. Any service with `common` on
its classpath has Spring Boot automatically discover and evaluate both classes at
startup — that's the entire mechanism by which `LoggingAspect` and (conditionally)
audit publishing "just work" the moment a service adds the `common` dependency, with
no manual `@Import`, no component-scan changes, and no per-service `@Bean` methods to
copy-paste.

## Dependencies

From `common/pom.xml`, required for every consumer:

- `spring-boot-starter`, `spring-boot-starter-aop` (the aspects need AspectJ weaving),
  `spring-boot-starter-validation`, `spring-web` (only for `HttpStatus`/
  `ResponseEntity` — chosen deliberately over a full web starter so this compiles
  cleanly for both Spring MVC consumers and the reactive `api-gateway`), and the jjwt
  libraries (`jjwt-api`/`jjwt-impl`/`jjwt-jackson`) plus `jackson-databind` for
  `JwtUtil` and event (de)serialization.

Marked `<optional>true</optional>` — present in `common`'s own build/tests, but **not**
transitively pulled into a consumer's classpath just by depending on `common`:

- **`spring-boot-starter-security`** — only needed by consumers that use `JwtAuthFilter`
  (i.e. every Spring MVC service that wires a `security/JwtFilter.java`). The reactive
  `api-gateway` has no use for servlet-based Spring Security and would gain nothing
  (and potentially conflict) from having it forced onto its classpath.
- **`spring-kafka`** — only needed by consumers that actually produce/consume Kafka
  events (audit publishing included). `discovery-server` and `config-server` depend on
  `common` (indirectly, or would if they needed any of its non-Kafka pieces) without
  ever pulling a Kafka client onto their classpath.

Marking these `optional` means: `common` itself compiles and works against them, but a
service that wants the *feature* backed by an optional dependency must redeclare that
dependency itself in its own `pom.xml` — Maven's `optional` deliberately does not
propagate transitively. This is exactly what makes the `@ConditionalOnClass` checks in
`AuditAutoConfiguration` meaningful: whether `KafkaTemplate` is present differs
per-consumer based on whether *that consumer* declared `spring-kafka`.

## Using it in a new service

If you're adding a 14th service to this platform:

1. Add the `common` dependency to the new service's `pom.xml`.
2. If it should publish/consume Kafka events (including audit trail entries): add
   `spring-kafka` as a direct dependency too — `common`'s Kafka-dependent
   auto-configuration only activates once a `KafkaTemplate` bean actually exists.
3. If it's a Spring MVC service that should re-validate bearer JWTs independently of
   the gateway (the platform convention — see `common`'s `JwtAuthFilter` and root
   README §6): add `spring-boot-starter-security`, then create your own
   `security/JwtFilter.java` that subclasses `common`'s `JwtAuthFilter`, supplying your
   `JwtUtil` bean and your service's list of public path prefixes.
4. Create your own `exception/GlobalExceptionHandler.java` as a
   `@RestControllerAdvice` extending `common`'s `BaseExceptionHandler`, and add
   `@ExceptionHandler` methods for `ApiException` plus any exceptions specific to your
   service.
5. For any service method whose successful completion should be recorded to the audit
   trail, annotate it `@Audited(action = "SOMETHING_HAPPENED", entityType = "Widget")`
   — and make sure the method's own parameters literally include `orgId` and one of
   `userId`/`actorId` by name if you want correct attribution (see "Known
   limitations" in auditor-service's README for what happens if you don't).
6. `LoggingAspect` and CORS/error-response conventions apply automatically the moment
   step 1 is done — nothing further to wire up for those.

## Testing

`common` has a `src/test/java` module (`spring-boot-starter-test`, test scope) covering
the pure-logic pieces that are cheapest to get real regression coverage on and most
consequential if they silently broke: `security/HmacVerifierTest` (signature
accept/reject, tamper detection, `sha256=` prefix handling), `security/JwtUtilTest`
(issue/parse round-trip, expiry, wrong-secret rejection, that the 6-arg `issue`
overload's `sid` argument actually round-trips as a claim, and that the 4-arg/5-arg
overloads leave that claim `null`), `security/SessionKeysTest` (the `session:<sid>` /
`user-sessions:<userId>` key-format assertions), and `aspect/AuditAspectTest`
(parameter-name attribution, that a failed publish doesn't
propagate, that a failed guarded method doesn't publish at all — using Mockito against
a real `Audited` instance pulled off a locally-annotated test method via reflection,
not a live AspectJ weave). `workflow-service` has the same setup for
`WorkflowStateMachineTest`, including a regression guard for the exact invariant
analytics-service's `TerminalStateResolver` depends on (every state, including
terminal ones, must have a `TRANSITIONS` entry — even an empty one).

Run just this module's tests with:

```bash
cd services
mvn -pl common test -o
```

Every one of the platform's 14 modules now has unit test coverage (322 tests total,
0 failures — see the root README's testing section for the full per-module breakdown
and `auth-service`'s README for its Testcontainers-adjacent notes), all following this
same Mockito-mocked, no-Spring-context style for speed. `maven-surefire-plugin`'s
version is pinned explicitly in the parent POM's `pluginManagement` (`3.5.2`) because
this project doesn't inherit `spring-boot-starter-parent` — without an explicit
version, Maven's own default Surefire is old enough that it doesn't reliably discover
JUnit 5 (JUnit Platform) tests at all, so `mvn test` would silently report zero tests
run rather than failing loudly. This is deliberately still just a unit-test baseline,
not integration coverage — no service exercises a real Postgres/Mongo/Kafka/Redis via
Testcontainers in this pass (`auth-service`'s pom has the dependencies wired for a
future pass, see its README), and no service has controller-level MVC tests.
