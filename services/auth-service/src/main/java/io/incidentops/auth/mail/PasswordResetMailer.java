package io.incidentops.auth.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Real SMTP delivery (MailHog in dev/docker-compose, per the confirmed decision to send
 *  an actual email rather than return a dev token in the API response). */
@Component
public class PasswordResetMailer {
    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String appBaseUrl;

    public PasswordResetMailer(JavaMailSender mailSender,
                                @Value("${incidentops.mail.from}") String fromAddress,
                                @Value("${incidentops.app.base-url}") String appBaseUrl) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.appBaseUrl = appBaseUrl;
    }

    public void sendResetLink(String toEmail, String rawToken) {
        var message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject("Reset your Incendra password");
        message.setText("Reset your password:\n" + appBaseUrl + "/reset-password?token=" + rawToken
                + "\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.");
        mailSender.send(message);
    }
}
