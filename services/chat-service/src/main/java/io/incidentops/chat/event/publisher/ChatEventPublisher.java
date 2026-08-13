package io.incidentops.chat.event.publisher;

import io.incidentops.chat.dto.event.MessageSentPayload;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class ChatEventPublisher {
    private final KafkaTemplate<String, DomainEvent> kafka;

    public ChatEventPublisher(KafkaTemplate<String, DomainEvent> kafka) {
        this.kafka = kafka;
    }

    public void publishMessageSent(String orgId, MessageSentPayload payload) {
        kafka.send(Topics.MESSAGE_SENT, orgId, DomainEvent.of(Topics.MESSAGE_SENT, orgId, payload.toMap()));
    }
}
