package io.incidentops.user.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.user.service.UserService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class UserEventConsumer {
    private final UserService service;

    public UserEventConsumer(UserService service) {
        this.service = service;
    }

    @KafkaListener(topics = Topics.USER_REGISTERED, groupId = "user-service")
    public void onUserRegistered(DomainEvent event) {
        service.consumeUserRegistered(event);
    }

    @KafkaListener(topics = Topics.USER_ROLE_CHANGED, groupId = "user-service")
    public void onUserRoleChanged(DomainEvent event) {
        service.consumeUserRoleChanged(event);
    }

    @KafkaListener(topics = Topics.USER_MEMBERSHIP_REMOVED, groupId = "user-service")
    public void onUserMembershipRemoved(DomainEvent event) {
        service.consumeUserMembershipRemoved(event);
    }
}
