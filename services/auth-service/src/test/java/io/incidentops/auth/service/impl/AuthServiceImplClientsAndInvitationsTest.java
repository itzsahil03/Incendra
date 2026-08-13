package io.incidentops.auth.service.impl;

import io.incidentops.auth.client.OrgClient;
import io.incidentops.auth.dto.request.CreateClientRequest;
import io.incidentops.auth.entity.Invitation;
import io.incidentops.auth.entity.Membership;
import io.incidentops.auth.entity.MembershipStatus;
import io.incidentops.auth.entity.PasswordResetToken;
import io.incidentops.auth.entity.RefreshToken;
import io.incidentops.auth.entity.ServiceClient;
import io.incidentops.auth.entity.UserAccount;
import io.incidentops.auth.event.publisher.AuthEventPublisher;
import io.incidentops.auth.exception.AlreadyOrgMemberException;
import io.incidentops.auth.exception.ClientAlreadyExistsException;
import io.incidentops.auth.exception.ClientNotFoundException;
import io.incidentops.auth.exception.InvalidClientException;
import io.incidentops.auth.exception.InvalidCredentialsException;
import io.incidentops.auth.exception.InvalidInvitationException;
import io.incidentops.auth.exception.InvalidPasswordResetTokenException;
import io.incidentops.auth.exception.InvitationAlreadyPendingException;
import io.incidentops.auth.exception.InvitationNotFoundException;
import io.incidentops.auth.mail.InvitationMailer;
import io.incidentops.auth.mail.PasswordResetMailer;
import io.incidentops.auth.mapper.AuthMapper;
import io.incidentops.auth.repository.InvitationRepository;
import io.incidentops.auth.repository.MembershipRepository;
import io.incidentops.auth.repository.PasswordResetTokenRepository;
import io.incidentops.auth.repository.RefreshTokenRepository;
import io.incidentops.auth.repository.ServiceClientRepository;
import io.incidentops.auth.repository.UserAccountRepository;
import io.incidentops.common.exception.ApiException;
import io.incidentops.common.model.Provider;
import io.incidentops.common.security.JwtUtil;
import io.incidentops.common.security.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Covers the AuthServiceImpl surface AuthServiceImplTest doesn't: my-orgs/org-summary,
 *  forgot/reset/change-password, logout, the service-client (API key) lifecycle, the
 *  invitation lifecycle (list/create/revoke/verify), and acceptInvitation's success path
 *  (the other test class only covers its rejection branches). Same conventions as that
 *  class — real JwtUtil/AuthMapper, everything else mocked. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceImplClientsAndInvitationsTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    @Mock private UserAccountRepository repo;
    @Mock private ServiceClientRepository serviceClientRepo;
    @Mock private RefreshTokenRepository refreshTokenRepo;
    @Mock private PasswordResetTokenRepository resetTokenRepo;
    @Mock private InvitationRepository invitationRepo;
    @Mock private MembershipRepository membershipRepo;
    @Mock private PasswordResetMailer mailer;
    @Mock private InvitationMailer invitationMailer;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthEventPublisher publisher;
    @Mock private StringRedisTemplate redis;
    @Mock private OrgClient orgClient;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private SetOperations<String, String> setOps;

    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        lenient().when(redis.opsForValue()).thenReturn(valueOps);
        lenient().when(redis.opsForSet()).thenReturn(setOps);
        lenient().when(setOps.members(anyString())).thenReturn(Set.of());

        service = new AuthServiceImpl(repo, serviceClientRepo, refreshTokenRepo, resetTokenRepo, invitationRepo,
                membershipRepo, mailer, invitationMailer, passwordEncoder, new JwtUtil(SECRET), new AuthMapper(),
                publisher, redis, orgClient);
    }

    private UserAccount user(String id, String email) {
        return new UserAccount(id, email, "Test User", "hashed-password", null, null, Instant.now());
    }

    private Membership membership(String userId, String orgId, Role role, Instant createdAt) {
        return new Membership("m-" + userId + "-" + orgId, userId, orgId, role, MembershipStatus.ACTIVE, createdAt);
    }

    // -------------------------------------------------------------------- myOrgs() ----

    @Test
    void myOrgsResolvesEachMembershipsOrgNameViaOrgClient() {
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));
        when(orgClient.getName("org-a")).thenReturn(new OrgClient.OrgNameDto("org-a", "Org A"));

        var result = service.myOrgs("u-1");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).orgId()).isEqualTo("org-a");
        assertThat(result.get(0).orgName()).isEqualTo("Org A");
        assertThat(result.get(0).role()).isEqualTo("ADMIN");
    }

    @Test
    void myOrgsFallsBackToRawOrgIdWhenOrgClientFails() {
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));
        when(orgClient.getName("org-a")).thenThrow(new RuntimeException("org-service unreachable"));

        var result = service.myOrgs("u-1");

        assertThat(result.get(0).orgName()).isEqualTo("org-a");
    }

    // --------------------------------------------------------------- orgSummary() ----

    @Test
    void orgSummaryCountsActiveMembersAndAdmins() {
        when(membershipRepo.countByOrgIdAndStatus("org-a", MembershipStatus.ACTIVE)).thenReturn(5L);
        when(membershipRepo.countByOrgIdAndStatusAndRole("org-a", MembershipStatus.ACTIVE, Role.ADMIN)).thenReturn(2L);

        var summary = service.orgSummary("org-a");

        assertThat(summary.memberCount()).isEqualTo(5L);
        assertThat(summary.adminCount()).isEqualTo(2L);
    }

    // ----------------------------------------------------------- forgotPassword() ----

    @Test
    void forgotPasswordSendsAResetLinkWhenTheAccountExists() {
        when(repo.findByEmail("a@example.com")).thenReturn(Optional.of(user("u-1", "a@example.com")));

        service.forgotPassword("a@example.com");

        verify(resetTokenRepo).save(any(PasswordResetToken.class));
        verify(mailer).sendResetLink(eqStr("a@example.com"), anyString());
    }

    @Test
    void forgotPasswordSilentlyNoOpsForAnUnregisteredEmailNeverRevealingWhichEmailsExist() {
        when(repo.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        service.forgotPassword("ghost@example.com");

        verify(resetTokenRepo, never()).save(any());
        verify(mailer, never()).sendResetLink(anyString(), anyString());
    }

    // ------------------------------------------------------------ resetPassword() ----

    @Test
    void resetPasswordUpdatesTheHashAndConsumesTheToken() {
        var prt = new PasswordResetToken("prt-1", "u-1", "hash", Instant.now().plusSeconds(3600), false);
        when(resetTokenRepo.findByTokenHash(anyString())).thenReturn(Optional.of(prt));
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.encode("newpass")).thenReturn("new-hash");

        service.resetPassword("plain-token", "newpass");

        verify(repo).save(argThat(u -> "new-hash".equals(u.getPasswordHash())));
        assertThat(prt.isUsed()).isTrue();
    }

    @Test
    void resetPasswordRejectsAnAlreadyUsedToken() {
        var prt = new PasswordResetToken("prt-1", "u-1", "hash", Instant.now().plusSeconds(3600), true);
        when(resetTokenRepo.findByTokenHash(anyString())).thenReturn(Optional.of(prt));

        assertThrows(InvalidPasswordResetTokenException.class, () -> service.resetPassword("token", "newpass"));
    }

    @Test
    void resetPasswordRejectsAnExpiredToken() {
        var prt = new PasswordResetToken("prt-1", "u-1", "hash", Instant.now().minusSeconds(10), false);
        when(resetTokenRepo.findByTokenHash(anyString())).thenReturn(Optional.of(prt));

        assertThrows(InvalidPasswordResetTokenException.class, () -> service.resetPassword("token", "newpass"));
    }

    @Test
    void resetPasswordRejectsAnUnknownToken() {
        when(resetTokenRepo.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThrows(InvalidPasswordResetTokenException.class, () -> service.resetPassword("token", "newpass"));
    }

    // ----------------------------------------------------------- changePassword() ----

    @Test
    void changePasswordUpdatesTheHashWhenCurrentPasswordMatches() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("old", "hashed-password")).thenReturn(true);
        when(passwordEncoder.encode("new")).thenReturn("new-hash");

        service.changePassword("u-1", "old", "new");

        verify(repo).save(argThat(u -> "new-hash".equals(u.getPasswordHash())));
    }

    @Test
    void changePasswordRejectsAWrongCurrentPassword() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("wrong", "hashed-password")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> service.changePassword("u-1", "wrong", "new"));
        verify(repo, never()).save(any());
    }

    // ------------------------------------------------------------------- logout() ----

    @Test
    void logoutRevokesTheMatchingRefreshToken() {
        var rt = new RefreshToken("rt-1", "u-1", "org-a", "hash", Instant.now().plusSeconds(3600), false);
        when(refreshTokenRepo.findByTokenHash(anyString())).thenReturn(Optional.of(rt));

        service.logout("plain-token");

        assertThat(rt.isRevoked()).isTrue();
        verify(refreshTokenRepo).save(rt);
    }

    @Test
    void logoutSilentlyNoOpsWhenTheTokenIsUnknown() {
        when(refreshTokenRepo.findByTokenHash(anyString())).thenReturn(Optional.empty());

        service.logout("unknown-token");

        verify(refreshTokenRepo, never()).save(any());
    }

    // ------------------------------------------------------------- listClients() ----

    private ServiceClient client(String id, String orgId, Provider provider, String scopes, Instant expiresAt, Instant revokedAt) {
        return new ServiceClient(id, "secret-hash", orgId, "My Client", provider, scopes,
                Instant.now(), expiresAt, revokedAt, null, 0L);
    }

    @Test
    void listClientsMapsEveryClientForTheOrg() {
        when(serviceClientRepo.findByOrgId("org-a")).thenReturn(List.of(
                client("c-1", "org-a", Provider.GENERIC, "", null, null)));
        when(valueOps.get(anyString())).thenReturn(null);

        var result = service.listClients("org-a");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).status()).isEqualTo("ACTIVE");
    }

    @Test
    void getClientReturnsClientScopedToTheCallersOrg() {
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(client("c-1", "org-a", Provider.GENERIC, "", null, null)));
        when(valueOps.get(anyString())).thenReturn("3");

        var result = service.getClient("org-a", "c-1");

        assertThat(result.clientId()).isEqualTo("c-1");
    }

    @Test
    void getClientThrowsWhenTheClientBelongsToADifferentOrg() {
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(client("c-1", "org-b", Provider.GENERIC, "", null, null)));

        assertThrows(ClientNotFoundException.class, () -> service.getClient("org-a", "c-1"));
    }

    @Test
    void toClientResponseReportsRevokedExpiredAndExpiringSoonStatuses() {
        when(serviceClientRepo.findById("revoked")).thenReturn(Optional.of(
                client("revoked", "org-a", Provider.GENERIC, "", null, Instant.now())));
        when(serviceClientRepo.findById("expired")).thenReturn(Optional.of(
                client("expired", "org-a", Provider.GENERIC, "", Instant.now().minusSeconds(10), null)));
        when(serviceClientRepo.findById("expiring")).thenReturn(Optional.of(
                client("expiring", "org-a", Provider.GENERIC, "", Instant.now().plusSeconds(3600), null)));
        when(valueOps.get(anyString())).thenReturn(null);

        assertThat(service.getClient("org-a", "revoked").status()).isEqualTo("REVOKED");
        assertThat(service.getClient("org-a", "expired").status()).isEqualTo("EXPIRED");
        assertThat(service.getClient("org-a", "expiring").status()).isEqualTo("EXPIRING_SOON");
    }

    @Test
    void recentClientUsageLimitsToTheRequestedCount() {
        when(serviceClientRepo.findTop5ByOrgIdAndLastUsedAtIsNotNullOrderByLastUsedAtDesc("org-a")).thenReturn(List.of(
                client("c-1", "org-a", Provider.GENERIC, "", null, null),
                client("c-2", "org-a", Provider.GENERIC, "", null, null)));
        when(valueOps.get(anyString())).thenReturn(null);

        var result = service.recentClientUsage("org-a", 1);

        assertThat(result).hasSize(1);
    }

    // ------------------------------------------------------------ createClient() ----

    @Test
    void createClientDefaultsToProviderScopesWhenNoneAreRequested() {
        var request = new CreateClientRequest("c-1", "My Client", "DATADOG", List.of(), null);
        when(serviceClientRepo.existsById("c-1")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-secret");

        var response = service.createClient("org-a", request);

        assertThat(response.clientId()).isEqualTo("c-1");
        assertThat(response.clientSecret()).startsWith("cs_");
        verify(serviceClientRepo).save(any(ServiceClient.class));
    }

    @Test
    void createClientRejectsADuplicateClientId() {
        var request = new CreateClientRequest("c-1", "My Client", "GENERIC", List.of(), null);
        when(serviceClientRepo.existsById("c-1")).thenReturn(true);

        assertThrows(ClientAlreadyExistsException.class, () -> service.createClient("org-a", request));
    }

    @Test
    void createClientRejectsAProviderThatDoesNotSupportApiKeys() {
        // SLACK supports webhook only, not API key connections (see ProviderMetadata).
        var request = new CreateClientRequest("c-1", "My Client", "SLACK", List.of(), null);
        when(serviceClientRepo.existsById("c-1")).thenReturn(false);

        var ex = assertThrows(ApiException.class, () -> service.createClient("org-a", request));
        assertThat(ex.getMessage()).contains("does not support API keys");
    }

    @Test
    void createClientRejectsAnUnknownScope() {
        var request = new CreateClientRequest("c-1", "My Client", "GENERIC", List.of("not.a.real.scope"), null);
        when(serviceClientRepo.existsById("c-1")).thenReturn(false);

        var ex = assertThrows(ApiException.class, () -> service.createClient("org-a", request));
        assertThat(ex.getMessage()).contains("Unknown scope");
    }

    @Test
    void createClientRejectsAnUnknownProviderName() {
        var request = new CreateClientRequest("c-1", "My Client", "NOT_A_PROVIDER", List.of(), null);
        when(serviceClientRepo.existsById("c-1")).thenReturn(false);

        assertThrows(ApiException.class, () -> service.createClient("org-a", request));
    }

    // ------------------------------------------------------------ rotateClient() ----

    @Test
    void rotateClientIssuesANewSecretForAnExistingClient() {
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(client("c-1", "org-a", Provider.GENERIC, "", null, null)));
        when(passwordEncoder.encode(anyString())).thenReturn("new-hash");

        var response = service.rotateClient("org-a", "c-1");

        assertThat(response.clientSecret()).startsWith("cs_");
        verify(serviceClientRepo).save(any(ServiceClient.class));
    }

    // ------------------------------------------------------------ deleteClient() ----

    @Test
    void deleteClientSoftRevokesRatherThanDeletingTheRow() {
        var c = client("c-1", "org-a", Provider.GENERIC, "", null, null);
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(c));

        service.deleteClient("org-a", "c-1");

        assertThat(c.getRevokedAt()).isNotNull();
        verify(serviceClientRepo).save(c);
        verify(serviceClientRepo, never()).delete(any());
        verify(serviceClientRepo, never()).deleteById(anyString());
    }

    // -------------------------------------------------------- clientCredentials() ----

    @Test
    void clientCredentialsIssuesAServiceTokenForValidCredentials() {
        var c = client("c-1", "org-a", Provider.GENERIC, "alerts.read", null, null);
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(c));
        when(passwordEncoder.matches("secret", "secret-hash")).thenReturn(true);

        var response = service.clientCredentials("c-1", "secret", "org-a");

        assertThat(response.tokenType()).isEqualTo("Bearer");
        verify(serviceClientRepo).save(c);
    }

    @Test
    void clientCredentialsRejectsAWrongSecret() {
        var c = client("c-1", "org-a", Provider.GENERIC, "", null, null);
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(c));
        when(passwordEncoder.matches("wrong", "secret-hash")).thenReturn(false);

        assertThrows(InvalidClientException.class, () -> service.clientCredentials("c-1", "wrong", "org-a"));
    }

    @Test
    void clientCredentialsRejectsAnOrgIdThatDoesNotMatchTheClientsOwnOrg() {
        var c = client("c-1", "org-a", Provider.GENERIC, "", null, null);
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(c));
        when(passwordEncoder.matches("secret", "secret-hash")).thenReturn(true);

        assertThrows(InvalidClientException.class, () -> service.clientCredentials("c-1", "secret", "org-b"));
    }

    @Test
    void clientCredentialsRejectsARevokedClient() {
        var c = client("c-1", "org-a", Provider.GENERIC, "", null, Instant.now());
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(c));
        when(passwordEncoder.matches("secret", "secret-hash")).thenReturn(true);

        assertThrows(InvalidClientException.class, () -> service.clientCredentials("c-1", "secret", "org-a"));
    }

    @Test
    void clientCredentialsRejectsAnExpiredClient() {
        var c = client("c-1", "org-a", Provider.GENERIC, "", Instant.now().minusSeconds(10), null);
        when(serviceClientRepo.findById("c-1")).thenReturn(Optional.of(c));
        when(passwordEncoder.matches("secret", "secret-hash")).thenReturn(true);

        assertThrows(InvalidClientException.class, () -> service.clientCredentials("c-1", "secret", "org-a"));
    }

    @Test
    void clientCredentialsRejectsAnUnknownClientId() {
        when(serviceClientRepo.findById("ghost")).thenReturn(Optional.empty());

        assertThrows(InvalidClientException.class, () -> service.clientCredentials("ghost", "secret", "org-a"));
    }

    // ------------------------------------------------------------ listInvitations() ----

    private Invitation invitation(String id, String orgId, String email, Role role, boolean accepted, boolean revoked) {
        return new Invitation(id, orgId, email, role, "token-hash", "admin-1",
                Instant.now().plusSeconds(3600), Instant.now(), revoked, accepted);
    }

    @Test
    void listInvitationsReturnsPendingInvitationsForTheOrg() {
        when(invitationRepo.findByOrgIdAndAcceptedFalseAndRevokedFalseOrderByCreatedAtDesc("org-a"))
                .thenReturn(List.of(invitation("inv-1", "org-a", "a@example.com", Role.VIEWER, false, false)));

        var result = service.listInvitations("org-a");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).email()).isEqualTo("a@example.com");
    }

    // ----------------------------------------------------------- createInvitation() ----

    @Test
    void createInvitationSendsAnEmailAndPersistsTheInvitation() {
        when(repo.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(invitationRepo.existsByOrgIdAndEmailIgnoreCaseAndAcceptedFalseAndRevokedFalse("org-a", "new@example.com"))
                .thenReturn(false);

        var response = service.createInvitation("org-a", "admin-1", "new@example.com", "RESPONDER");

        assertThat(response.email()).isEqualTo("new@example.com");
        verify(invitationRepo).save(any(Invitation.class));
        verify(invitationMailer).sendInvite(eqStr("new@example.com"), eqStr("RESPONDER"), anyString());
    }

    @Test
    void createInvitationRejectsAnEmailThatIsAlreadyAnActiveMember() {
        var existing = user("u-2", "existing@example.com");
        when(repo.findByEmail("existing@example.com")).thenReturn(Optional.of(existing));
        when(membershipRepo.existsByUserIdAndOrgIdAndStatus("u-2", "org-a", MembershipStatus.ACTIVE)).thenReturn(true);

        assertThrows(AlreadyOrgMemberException.class,
                () -> service.createInvitation("org-a", "admin-1", "existing@example.com", "VIEWER"));
        verify(invitationRepo, never()).save(any());
    }

    @Test
    void createInvitationRejectsADuplicatePendingInvitationForTheSameEmail() {
        when(repo.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(invitationRepo.existsByOrgIdAndEmailIgnoreCaseAndAcceptedFalseAndRevokedFalse("org-a", "new@example.com"))
                .thenReturn(true);

        assertThrows(InvitationAlreadyPendingException.class,
                () -> service.createInvitation("org-a", "admin-1", "new@example.com", "VIEWER"));
    }

    // ----------------------------------------------------------- revokeInvitation() ----

    @Test
    void revokeInvitationMarksItRevoked() {
        var inv = invitation("inv-1", "org-a", "a@example.com", Role.VIEWER, false, false);
        when(invitationRepo.findById("inv-1")).thenReturn(Optional.of(inv));

        service.revokeInvitation("org-a", "inv-1");

        assertThat(inv.isRevoked()).isTrue();
        verify(invitationRepo).save(inv);
    }

    @Test
    void revokeInvitationRejectsAnInvitationBelongingToAnotherOrg() {
        var inv = invitation("inv-1", "org-b", "a@example.com", Role.VIEWER, false, false);
        when(invitationRepo.findById("inv-1")).thenReturn(Optional.of(inv));

        assertThrows(InvitationNotFoundException.class, () -> service.revokeInvitation("org-a", "inv-1"));
        verify(invitationRepo, never()).save(any());
    }

    // ----------------------------------------------------------- verifyInvitation() ----

    @Test
    void verifyInvitationEnrichesWithOrgNameAndInviterNameAndExistingAccountFlag() {
        var inv = invitation("inv-1", "org-a", "invited@example.com", Role.RESPONDER, false, false);
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(inv));
        when(orgClient.getName("org-a")).thenReturn(new OrgClient.OrgNameDto("org-a", "Org A"));
        when(repo.findById("admin-1")).thenReturn(Optional.of(user("admin-1", "admin@example.com")));
        when(repo.findByEmail("invited@example.com")).thenReturn(Optional.of(user("u-2", "invited@example.com")));

        var preview = service.verifyInvitation("plain-token");

        assertThat(preview.orgName()).isEqualTo("Org A");
        assertThat(preview.invitedByName()).isEqualTo("Test User");
        assertThat(preview.hasExistingAccount()).isTrue();
    }

    @Test
    void verifyInvitationFallsBackToInviterIdWhenTheInviterAccountIsGone() {
        var inv = invitation("inv-1", "org-a", "invited@example.com", Role.RESPONDER, false, false);
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(inv));
        when(orgClient.getName("org-a")).thenThrow(new RuntimeException("unreachable"));
        when(repo.findById("admin-1")).thenReturn(Optional.empty());
        when(repo.findByEmail("invited@example.com")).thenReturn(Optional.empty());

        var preview = service.verifyInvitation("plain-token");

        assertThat(preview.orgName()).isEqualTo("org-a");
        assertThat(preview.invitedByName()).isEqualTo("admin-1");
        assertThat(preview.hasExistingAccount()).isFalse();
    }

    @Test
    void verifyInvitationRejectsARevokedInvitation() {
        var inv = invitation("inv-1", "org-a", "invited@example.com", Role.RESPONDER, false, true);
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(inv));

        assertThrows(InvalidInvitationException.class, () -> service.verifyInvitation("plain-token"));
    }

    // ----------------------------------------------------------- acceptInvitation() ----

    @Test
    void acceptInvitationSuccessCreatesMembershipRotatesSessionAndPublishesUserRegistered() {
        var inv = invitation("inv-1", "org-a", "same@example.com", Role.RESPONDER, false, false);
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(inv));
        when(repo.findById("caller-id")).thenReturn(Optional.of(user("caller-id", "same@example.com")));
        when(membershipRepo.existsByUserIdAndOrgId("caller-id", "org-a")).thenReturn(false);
        when(invitationRepo.markAcceptedIfPending("inv-1")).thenReturn(1);
        var currentToken = new RefreshToken("rt-1", "caller-id", "org-current", "hash", Instant.now().plusSeconds(3600), false);
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(currentToken));

        var response = service.acceptInvitation("caller-id", "org-current", "token", "refresh-token");

        assertThat(response.user().orgId()).isEqualTo("org-a");
        assertThat(response.user().role()).isEqualTo("RESPONDER");
        assertThat(currentToken.isRevoked()).isTrue();
        verify(membershipRepo).save(any(Membership.class));
        verify(publisher).publishUserRegistered(any());
    }

    @Test
    void acceptInvitationConcurrentlyAlreadyAcceptedAbortsAfterMembershipCheck() {
        var inv = invitation("inv-1", "org-a", "same@example.com", Role.RESPONDER, false, false);
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(inv));
        when(repo.findById("caller-id")).thenReturn(Optional.of(user("caller-id", "same@example.com")));
        when(membershipRepo.existsByUserIdAndOrgId("caller-id", "org-a")).thenReturn(false);
        when(invitationRepo.markAcceptedIfPending("inv-1")).thenReturn(0);

        assertThrows(io.incidentops.auth.exception.InvitationAlreadyAcceptedException.class,
                () -> service.acceptInvitation("caller-id", "org-current", "token", "refresh-token"));
        verify(membershipRepo, never()).save(any());
    }

    private static String eqStr(String value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }

    private static UserAccount argThat(java.util.function.Predicate<UserAccount> predicate) {
        return org.mockito.ArgumentMatchers.argThat(predicate::test);
    }
}
