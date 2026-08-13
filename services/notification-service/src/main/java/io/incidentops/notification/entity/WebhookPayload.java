package io.incidentops.notification.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Map;

/** Request/response detail for one {@link WebhookDelivery}, split into its own
 *  document (round 2 feedback: keep the delivery list lightweight) and fetched only
 *  when a user expands a row. {@code requestBody} is fixed at the first attempt (a
 *  retry resends the identical bytes, only re-signed if the secret rotated in between);
 *  {@code responseBody}/{@code responseHeaders} are overwritten by each attempt to
 *  reflect the most recent response. All three are truncated before being stored. */
@Document("webhook_payloads")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class WebhookPayload {
    public static final int MAX_BODY_CHARS = 8192;

    @Id
    private String id;
    @Indexed
    private String deliveryId;
    private String requestBody;
    private String responseBody;
    private Map<String, String> responseHeaders;
}
