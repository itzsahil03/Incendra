package io.incidentops.chat.dto.event;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MessageSentPayloadTest {

    @Test
    void toMapContainsAllFieldsUnderTheirContractKeys() {
        var payload = new MessageSentPayload("msg-1", "inc-1", "user-1", "Priya", "hello world");

        var map = payload.toMap();

        assertThat(map)
                .containsEntry("messageId", "msg-1")
                .containsEntry("incidentId", "inc-1")
                .containsEntry("userId", "user-1")
                .containsEntry("userName", "Priya")
                .containsEntry("text", "hello world");
        assertThat(map).doesNotContainKey("orgId");
    }

    @Test
    void toMapPreservesNullFieldsRatherThanOmittingThem() {
        var payload = new MessageSentPayload("msg-1", "inc-1", null, null, "hello");

        var map = payload.toMap();

        assertThat(map).containsKey("userId");
        assertThat(map.get("userId")).isNull();
        assertThat(map).containsKey("userName");
        assertThat(map.get("userName")).isNull();
    }

    @Test
    void recordAccessorsExposeTheConstructorArguments() {
        var payload = new MessageSentPayload("msg-1", "inc-1", "user-1", "Priya", "hello");

        assertThat(payload.messageId()).isEqualTo("msg-1");
        assertThat(payload.incidentId()).isEqualTo("inc-1");
        assertThat(payload.userId()).isEqualTo("user-1");
        assertThat(payload.userName()).isEqualTo("Priya");
        assertThat(payload.text()).isEqualTo("hello");
    }
}
