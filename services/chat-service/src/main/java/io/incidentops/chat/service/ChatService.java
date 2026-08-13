package io.incidentops.chat.service;

import io.incidentops.chat.dto.request.PostMessageRequest;
import io.incidentops.chat.dto.response.ChatMessageResponse;
import io.incidentops.common.events.DomainEvent;

import java.util.List;

public interface ChatService {
    List<ChatMessageResponse> listMessages(String incidentId);

    ChatMessageResponse postMessage(String orgId, String userId, String userName, String incidentId,
                                     PostMessageRequest request) throws Exception;

    void handleWorkflowTransition(DomainEvent event) throws Exception;

    /** Wipes every chat message owned by a deleted org. No ConsumedEvent dedup infra
     *  exists in this service — a bulk delete-by-orgId is naturally idempotent on
     *  redelivery (second delivery just deletes zero rows), so none is needed here. */
    void handleOrgDeleted(DomainEvent event);
}
