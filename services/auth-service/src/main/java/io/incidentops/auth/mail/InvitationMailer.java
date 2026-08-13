package io.incidentops.auth.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Real SMTP delivery (MailHog in dev/docker-compose), same convention as
 *  PasswordResetMailer — the invite token is never returned in any API response, only
 *  ever delivered here. */
@Component
public class InvitationMailer {
    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String appBaseUrl;

    public InvitationMailer(JavaMailSender mailSender,
                             @Value("${incidentops.mail.from}") String fromAddress,
                             @Value("${incidentops.app.base-url}") String appBaseUrl) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.appBaseUrl = appBaseUrl;
    }

    public void sendInvite(String toEmail, String role, String rawToken) {
        var message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject("You've been invited to join a team on Incendra");
        message.setText("You've been invited to join a team on Incendra as " + role + ".\n\n"
                + "Accept the invite:\n" + appBaseUrl + "/invitations/" + rawToken
                + "\n\nThis link expires in 7 days. If you weren't expecting this, you can ignore this email.");
        mailSender.send(message);
    }
}
