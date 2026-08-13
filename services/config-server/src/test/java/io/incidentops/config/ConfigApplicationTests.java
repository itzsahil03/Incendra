package io.incidentops.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** config-server is pure infrastructure — {@code ConfigApplication} is just
 *  {@code @SpringBootApplication} + {@code @EnableConfigServer}, no custom business
 *  logic of its own (see README's "Architecture" section). The one thing genuinely
 *  worth regression-testing here is that the Spring context actually starts: a broken
 *  Config Server auto-configuration, a bad bean wiring, or an invalid
 *  {@code spring.cloud.config.server.native.search-locations} value would fail this
 *  test even though there is no application code to unit-test directly. Uses the
 *  {@code dev} profile alongside {@code native}. Both are needed: {@code dev} supplies
 *  the local Eureka URL/logging overrides, while {@code native} is what actually
 *  selects Spring Cloud Config Server's classpath-backed {@code NativeEnvironmentRepository}
 *  instead of its default git-backed one (its auto-configuration gates that choice on a
 *  {@code @Profile("native")} check). Base {@code application.yml} sets
 *  {@code spring.profiles.active: native} for exactly this reason when the app runs
 *  normally, but {@code @ActiveProfiles} in tests replaces rather than adds to that
 *  property, so {@code native} has to be listed here explicitly too — omitting it
 *  makes the context fail to start with "You need to configure a uri for the git
 *  repository," since no git URI is configured anywhere in this service. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"native", "dev"})
class ConfigApplicationTests {

    @Test
    void contextLoads() {
        // Intentionally empty: the assertion is that the ApplicationContext above
        // refreshes without throwing. See class javadoc for why this is meaningful
        // despite there being no custom code in this service.
    }
}
