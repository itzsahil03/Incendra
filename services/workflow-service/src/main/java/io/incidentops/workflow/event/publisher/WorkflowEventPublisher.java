package io.incidentops.workflow.event.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.workflow.dto.event.WorkflowTransitionPayload;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Wraps every KafkaTemplate.send(...) call this service makes so the producer side of the
 *  Kafka contract lives in one place instead of scattered across the service layer. */
@Component
public class WorkflowEventPublisher {
    private final KafkaTemplate<String, DomainEvent> kafka;
    private final ObjectMapper objectMapper;

    public WorkflowEventPublisher(KafkaTemplate<String, DomainEvent> kafka, ObjectMapper objectMapper) {
        this.kafka = kafka;
        this.objectMapper = objectMapper;
    }

    public void publishTransition(String orgId, WorkflowTransitionPayload payload) {
        var event = DomainEvent.of(Topics.WORKFLOW_TRANSITION, orgId, toMap(payload));
        kafka.send(Topics.WORKFLOW_TRANSITION, orgId, event);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object payload) {
        return objectMapper.convertValue(payload, Map.class);
    }
}
