package io.incidentops.auth.event.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.auth.dto.event.OrgDeletedPayload;
import io.incidentops.auth.dto.event.UserMembershipRemovedPayload;
import io.incidentops.auth.dto.event.UserRegisteredPayload;
import io.incidentops.auth.dto.event.UserRoleChangedPayload;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AuthEventPublisher {
    private final KafkaTemplate<String, DomainEvent> kafka;
    private final ObjectMapper objectMapper;

    public AuthEventPublisher(KafkaTemplate<String, DomainEvent> kafka, ObjectMapper objectMapper) {
        this.kafka = kafka;
        this.objectMapper = objectMapper;
    }

    public void publishUserRegistered(UserRegisteredPayload payload) {
        var event = DomainEvent.of(Topics.USER_REGISTERED, payload.orgId(), toMap(payload));
        kafka.send(Topics.USER_REGISTERED, payload.orgId(), event);
    }

    public void publishUserRoleChanged(UserRoleChangedPayload payload) {
        var event = DomainEvent.of(Topics.USER_ROLE_CHANGED, payload.orgId(), toMap(payload));
        kafka.send(Topics.USER_ROLE_CHANGED, payload.orgId(), event);
    }

    public void publishUserMembershipRemoved(UserMembershipRemovedPayload payload) {
        var event = DomainEvent.of(Topics.USER_MEMBERSHIP_REMOVED, payload.orgId(), toMap(payload));
        kafka.send(Topics.USER_MEMBERSHIP_REMOVED, payload.orgId(), event);
    }

    public void publishOrgDeleted(OrgDeletedPayload payload) {
        var event = DomainEvent.of(Topics.ORG_DELETED, payload.orgId(), toMap(payload));
        kafka.send(Topics.ORG_DELETED, payload.orgId(), event);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object payload) {
        return objectMapper.convertValue(payload, Map.class);
    }
}
