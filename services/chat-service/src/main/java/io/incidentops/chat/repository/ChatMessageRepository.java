package io.incidentops.chat.repository;

import io.incidentops.chat.entity.ChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findByIncidentIdOrderByCreatedAtAsc(String incidentId);

    void deleteByOrgId(String orgId);
}
