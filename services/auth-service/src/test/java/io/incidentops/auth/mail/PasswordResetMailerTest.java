package io.incidentops.auth.mail;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class PasswordResetMailerTest {

    @Mock
    JavaMailSender mailSender;

    private PasswordResetMailer mailer;

    @BeforeEach
    void setUp() {
        mailer = new PasswordResetMailer(mailSender, "noreply@incendra.io", "https://app.incendra.io");
    }

    @Test
    void sendResetLinkBuildsAMessageWithTheResetLink() {
        mailer.sendResetLink("a@example.com", "plain-token-123");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        var message = captor.getValue();
        assertThat(message.getFrom()).isEqualTo("noreply@incendra.io");
        assertThat(message.getTo()).containsExactly("a@example.com");
        assertThat(message.getText()).contains("https://app.incendra.io/reset-password?token=plain-token-123");
    }
}
