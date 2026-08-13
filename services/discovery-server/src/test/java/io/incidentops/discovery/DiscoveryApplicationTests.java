package io.incidentops.discovery;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** discovery-server is pure infrastructure — {@code DiscoveryApplication} is just
 *  {@code @SpringBootApplication} + {@code @EnableEurekaServer}, no custom business
 *  logic of its own (see README's "Architecture" section). The one thing genuinely
 *  worth regression-testing here is that the Spring context actually starts: a broken
 *  Eureka server auto-configuration, a bad bean wiring, or an invalid
 *  {@code application-dev.yml} property would fail this test even though there is no
 *  application code to unit-test directly. Uses the {@code dev} profile so it runs
 *  standalone (register-with-eureka/fetch-registry both off — see README) without
 *  needing a running Eureka peer. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
class DiscoveryApplicationTests {

    @Test
    void contextLoads() {
        // Intentionally empty: the assertion is that the ApplicationContext above
        // refreshes without throwing. See class javadoc for why this is meaningful
        // despite there being no custom code in this service.
    }
}
