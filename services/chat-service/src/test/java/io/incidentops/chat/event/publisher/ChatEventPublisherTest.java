package io.incidentops.chat.event.publisher;

import io.incidentops.chat.dto.event.MessageSentPayload;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ChatEventPublisherTest {

    @Mock
    KafkaTemplate<String, DomainEvent> kafka;

    private ChatEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new ChatEventPublisher(kafka);
    }

    @Test
    void publishMessageSentSendsToTheMessageSentTopicKeyedByOrgId() {
        var payload = new MessageSentPayload("msg-1", "inc-1", "user-1", "Priya", "hello");

        publisher.publishMessageSent("org-1", payload);

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.MESSAGE_SENT), eq("org-1"), captor.capture());
        assertThat(captor.getValue().topic()).isEqualTo(Topics.MESSAGE_SENT);
        assertThat(captor.getValue().payload()).containsEntry("messageId", "msg-1").containsEntry("text", "hello");
    }
}
