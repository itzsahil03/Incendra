# config-server

Spring Cloud Config Server (`@EnableConfigServer`), running in the `native` profile —
it serves configuration from the classpath rather than a git backend. In this
platform's current setup, every service actually configures itself via its own
bundled `application.yml`/`application-{profile}.yml`, so this service exists as
platform-standard infrastructure for centralized config but is not a hard dependency
any service fails without today.

## Architecture

- **Port:** 8888
- Pure infrastructure — `ConfigApplication.java` is `@SpringBootApplication` +
  `@EnableConfigServer` and nothing else. None of the per-service package layering
  described in root README §9.1 applies here.
- Depends on `spring-cloud-config-server` and
  `spring-cloud-starter-netflix-eureka-client` (registers itself with Eureka like any
  other service, so it can in principle be discovered/load-balanced too).

## Configuration

| Property | `application.yml` (base) | Notes |
|---|---|---|
| `server.port` | `8888` | |
| `spring.profiles.active` | `native` | Serves config from the classpath, not a git repo |
| `spring.cloud.config.server.native.search-locations` | `classpath:/configs` | This directory does not currently exist under `src/main/resources/` in this repo — see Known limitations |
| `eureka.client.serviceUrl.defaultZone` | `http://discovery-server:8761/eureka` (env `EUREKA_SERVER`) | |
| `eureka.instance.prefer-ip-address` | `true` | |

`application-dev.yml` points Eureka at `localhost` and sets `DEBUG` logging for local,
non-Docker runs. `application-prod.yml` only sets `logging.level.io.incidentops: INFO`
and `management.endpoint.health.show-details: never`.

## Running standalone

```bash
cd services
mvn -pl config-server spring-boot:run -Dspring-boot.run.profiles=dev
```

Note: since `classpath:/configs` doesn't currently contain any config files in this
repo, this service starts but has nothing to actually serve yet — every other service
still self-configures from its own bundled `application.yml`, so this is not currently
a blocking dependency for running the rest of the platform.

## Testing

`ConfigApplicationTests` (`src/test/java/io/incidentops/config/`) is a single
`@SpringBootTest` context-loads smoke test, run under `@ActiveProfiles({"native",
"dev"})`. That's the entire test suite, deliberately: as the "Architecture" section
above notes, there is no custom Java code here beyond the two annotations on
`ConfigApplication` — no controller, service, or repository logic of this service's own
to unit-test. A context-loads test is not a placeholder or an oversight here; it's the
one thing that actually exercises real risk for a service like this — a broken Config
Server auto-configuration or a misconfigured bean would fail it, where a unit test
would have nothing to call.

Both `native` and `dev` have to be listed explicitly in the test's `@ActiveProfiles`,
which is one profile more than you'd expect from just running the app normally. Spring
Cloud Config Server picks its backend based on which profile is active — the
`native`-backed `NativeEnvironmentRepository` only activates under the `native` profile
(see the "Configuration" table above); everything else falls through to its default
git-backed repository, which then fails to start with "You need to configure a uri for
the git repository," since this service has no git URI configured anywhere. Normally
`application.yml`'s own `spring.profiles.active: native` handles this, but
`@ActiveProfiles` in a test replaces rather than adds to that property, so omitting
`native` from the test annotation reproduces that exact startup failure. Run the suite
with:

```bash
cd services
mvn -pl config-server -am test -o
```
