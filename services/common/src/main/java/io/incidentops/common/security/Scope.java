package io.incidentops.common.security;

import java.util.Set;

/** Fine-grained permissions carried by client_credentials service tokens (see
 *  auth-service's {@code ServiceClient.scopes} and {@link JwtUtil}'s "scopes" claim).
 *  Deliberately flat {@code resource.action} strings, not one enum constant per
 *  resource/action pair — adding a new resource later is one new line here, not a
 *  combinatorial explosion of enum constants. */
public final class Scope {
    private Scope() {}

    public static final String ALERTS_READ = "alerts.read";
    public static final String ALERTS_WRITE = "alerts.write";
    public static final String INCIDENTS_READ = "incidents.read";
    public static final String INCIDENTS_WRITE = "incidents.write";
    public static final String ANALYTICS_READ = "analytics.read";
    public static final String NOTIFICATIONS_WRITE = "notifications.write";
    public static final String WEBHOOKS_READ = "webhooks.read";
    public static final String WEBHOOKS_WRITE = "webhooks.write";

    public static final Set<String> KNOWN = Set.of(
            ALERTS_READ, ALERTS_WRITE, INCIDENTS_READ, INCIDENTS_WRITE,
            ANALYTICS_READ, NOTIFICATIONS_WRITE, WEBHOOKS_READ, WEBHOOKS_WRITE
    );
}
