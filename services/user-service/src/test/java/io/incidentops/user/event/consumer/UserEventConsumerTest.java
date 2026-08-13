package io.incidentops.user.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.mockito.Mockito.verify;

/** UserEventConsumer's @KafkaListener methods are trivial one-line delegations to
 *  UserService — real dedup/consumption logic already lives in and is tested via
 *  UserServiceImplTest. Called directly here (no embedded Kafka broker needed). */
@ExtendWith(MockitoExtension.class)
class UserEventConsumerTest {

    @Mock
    UserService service;

    UserEventConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new UserEventConsumer(service);
    }

    private DomainEvent event(String topic) {
        return new DomainEvent("evt-1", topic, "org-1", Instant.now(), Map.of("userId", "u-1"));
    }

    @Test
    void onUserRegisteredDelegatesToService() {
        var event = event("UserRegistered");

        consumer.onUserRegistered(event);

        verify(service).consumeUserRegistered(event);
    }

    @Test
    void onUserRoleChangedDelegatesToService() {
        var event = event("UserRoleChanged");

        consumer.onUserRoleChanged(event);

        verify(service).consumeUserRoleChanged(event);
    }

    @Test
    void onUserMembershipRemovedDelegatesToService() {
        var event = event("UserMembershipRemoved");

        consumer.onUserMembershipRemoved(event);

        verify(service).consumeUserMembershipRemoved(event);
    }
}
