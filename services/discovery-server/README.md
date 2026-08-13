# discovery-server

Netflix Eureka service registry (`@EnableEurekaServer`). Every other service in the
platform registers itself here on startup and looks up every other service's live
instances here too, which is what lets `api-gateway`'s routes use `lb://<service-id>`
instead of hardcoded hosts/ports (see root README §8 "Eureka + Cloud Gateway >
hardcoded hosts").

## Architecture

- **Port:** 8761
- Pure infrastructure — `DiscoveryApplication.java` is `@SpringBootApplication` +
  `@EnableEurekaServer` and nothing else. None of the per-service package layering
  described in root README §9.1 (`controller/`, `service/`, `entity/`, etc.) applies
  here; there is no other Java code in this service.
- Depends only on `spring-cloud-starter-netflix-eureka-server` and
  `spring-boot-starter-actuator` (health endpoint).

## Configuration

Eureka's own client settings are unusual here because a Eureka *server* also acts as
its own client by default, and the settings differ meaningfully across profiles:

| Setting | `application.yml` (base) | `application-dev.yml` |
|---|---|---|
| `eureka.client.register-with-eureka` | `true` | `false` |
| `eureka.client.fetch-registry` | `true` | `false` |
| `eureka.client.service-url.defaultZone` | `http://localhost:8761/eureka` | (inherited) |
| `eureka.instance.hostname` | `localhost` | (inherited) |
| `eureka.instance.prefer-ip-address` | `false` | (inherited) |

The base `application.yml` leaves `register-with-eureka`/`fetch-registry` at `true` —
appropriate for a multi-node Eureka peer-awareness setup — while `application-dev.yml`
(local, single-node development) explicitly turns both off, since a single standalone
registry has no peers to register with or replicate from and doing so otherwise just
produces noisy self-registration/self-lookup log output. `application-prod.yml` adds
no Eureka overrides at all — only `logging.level.io.incidentops: INFO` and
`management.endpoint.health.show-details: never`.

## Running standalone

```bash
cd services
mvn -pl discovery-server spring-boot:run -Dspring-boot.run.profiles=dev
```

Dashboard at `http://localhost:8761/`. No other service or database is required for
this one to start — it's the first thing every other service waits on.

## Testing

`DiscoveryApplicationTests` (`src/test/java/io/incidentops/discovery/`) is a single
`@SpringBootTest` context-loads smoke test, run under the `dev` profile. That's the
entire test suite, deliberately: as the "Architecture" section above notes, there is no
custom Java code here beyond the two annotations on `DiscoveryApplication` — no
controller, service, or repository logic of this service's own to unit-test. A
context-loads test is not a placeholder or an oversight here; it's the one thing that
actually exercises real risk for a service like this — a broken Eureka server
auto-configuration, a misconfigured bean, or an invalid `application-dev.yml` property
(e.g. a typo'd `eureka.client.*` key) would fail it, where a unit test would have
nothing to call. Run it with:

```bash
cd services
mvn -pl discovery-server -am test -o
```
