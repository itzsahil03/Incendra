package io.incidentops.chat.dto.event;

import java.util.LinkedHashMap;
import java.util.Map;

/** Typed shape of the {@code MessageSent} {@link io.incidentops.common.events.DomainEvent}
 *  payload — see common/EVENTS.md. Keys must stay byte-identical to the contract:
 *  {@code {messageId, orgId, incidentId, userId, userName, text}} (orgId carried by the
 *  envelope itself, so it's not duplicated here — matches the payload map built previously). */
public record MessageSentPayload(String messageId, String incidentId, String userId, String userName, String text) {
    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("messageId", messageId);
        m.put("incidentId", incidentId);
        m.put("userId", userId);
        m.put("userName", userName);
        m.put("text", text);
        return m;
    }
}
