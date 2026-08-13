package io.incidentops.notification.dto.response;

/** {@code real=true} means {@code payload} is an actual captured delivery for that
 *  org+topic; {@code real=false} means no delivery has happened yet for that topic and
 *  this is a bare envelope skeleton instead (see WebhookDispatcher's javadoc — never a
 *  hand-maintained fixture that could drift from the real event model). */
public record SamplePayloadResponse(
        String topic,
        String payload,
        boolean real
) {}
