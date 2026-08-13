package io.incidentops.auth.service.impl;

import io.incidentops.auth.client.OrgClient;
import io.incidentops.auth.dto.request.RegisterRequest;
import io.incidentops.auth.dto.request.LoginRequest;
import io.incidentops.auth.entity.Invitation;
import io.incidentops.auth.entity.Membership;
import io.incidentops.auth.entity.MembershipStatus;
import io.incidentops.auth.entity.RefreshToken;
import io.incidentops.auth.entity.UserAccount;
import io.incidentops.auth.event.publisher.AuthEventPublisher;
import io.incidentops.auth.exception.AlreadyOrgMemberException;
import io.incidentops.auth.exception.EmailAlreadyExistsException;
import io.incidentops.auth.exception.InvalidCredentialsException;
import io.incidentops.auth.exception.InvalidInvitationException;
import io.incidentops.auth.exception.InvalidRefreshTokenException;
import io.incidentops.auth.exception.LastAdminException;
import io.incidentops.auth.exception.MembershipInactiveException;
import io.incidentops.auth.exception.NotOrgMemberException;
import io.incidentops.auth.exception.NotSoleAdminException;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit tests for the highest-risk, most session-critical logic added/changed this
 *  session: atomic name-first org creation, multi-org membership, Redis-backed
 *  immediate session revocation, last-admin protection, and the account-deletion
 *  cascade (leave/remove/delete-org all funnel into the same "zero ACTIVE memberships
 *  anywhere -> delete the account outright" rule). Every collaborator is mocked except
 *  {@link JwtUtil} and {@link AuthMapper}, which have no external dependencies of their
 *  own and are simpler/more realistic to use for real than to stub out. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceImplTest {

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
        // registerSession() is called by every real session-issuing path exercised
        // below — stubbing these up front keeps every individual test from having to
        // repeat this Redis-plumbing boilerplate.
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

    private RefreshToken refreshToken(String userId, String orgId, String hash) {
        var rt = new RefreshToken("rt-1", userId, orgId, hash, Instant.now().plusSeconds(3600), false);
        return rt;
    }

    // ---------------------------------------------------------------- register() ----

    @Test
    void register_withOrgName_provisionsOrgBeforeSavingAccountAndIssuesAdminSession() {
        var request = new RegisterRequest("new@example.com", "New User", "password123", null, null, "My Org"); // orgId=null, inviteToken=null, orgName="My Org"
        when(repo.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("hashed");
        when(orgClient.provision(anyString(), any())).thenReturn(new OrgClient.OrgDto("org-x", "My Org", "secret", "now"));

        var response = service.register(request);

        assertThat(response.user().role()).isEqualTo("ADMIN");
        assertThat(response.user().email()).isEqualTo("new@example.com");
        verify(orgClient).provision(anyString(), any());
        verify(repo).save(any(UserAccount.class));
        verify(membershipRepo).save(any(Membership.class));
        verify(publisher).publishUserRegistered(any());
    }

    @Test
    void register_emailAlreadyExists_throwsBeforeCallingOrgService() {
        var request = new RegisterRequest("dupe@example.com", "Dup", "password123", null, null, "Org");
        when(repo.findByEmail("dupe@example.com")).thenReturn(Optional.of(user("u-1", "dupe@example.com")));

        assertThrows(EmailAlreadyExistsException.class, () -> service.register(request));
        verify(orgClient, never()).provision(anyString(), any());
        verify(repo, never()).save(any());
    }

    @Test
    void register_withoutInviteOrOrgName_throwsBadRequestAndNeverCallsOrgService() {
        var request = new RegisterRequest("x@example.com", "X", "password123", null, null, null);
        when(repo.findByEmail("x@example.com")).thenReturn(Optional.empty());

        var ex = assertThrows(ApiException.class, () -> service.register(request));

        assertThat(ex.getMessage()).contains("invite token or an organization name");
        verify(orgClient, never()).provision(anyString(), any());
        verify(repo, never()).save(any());
    }

    @Test
    void register_withInviteToken_joinsInvitedOrgAndMarksInvitationAccepted() {
        var invitation = new Invitation("inv-1", "org-inv", "invited@example.com", Role.RESPONDER,
                "hashed-token", "admin-1", Instant.now().plusSeconds(3600), Instant.now(), false, false);
        var request = new RegisterRequest("invited@example.com", "Invited", "password123", null, "plain-token", null); // orgId=null, inviteToken="plain-token"
        when(repo.findByEmail("invited@example.com")).thenReturn(Optional.empty());
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(invitation));
        when(invitationRepo.markAcceptedIfPending("inv-1")).thenReturn(1);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        var response = service.register(request);

        assertThat(response.user().orgId()).isEqualTo("org-inv");
        assertThat(response.user().role()).isEqualTo("RESPONDER");
        verify(orgClient, never()).provision(anyString(), any());
        verify(invitationRepo).markAcceptedIfPending("inv-1");
    }

    // ------------------------------------------------------------------- login() ----

    @Test
    void login_singleActiveMembership_returnsSessionForThatOrgWithRefreshToken() {
        var u = user("u-1", "a@example.com");
        when(repo.findByEmail("a@example.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));

        var response = service.login(new LoginRequest("a@example.com", "pw"));

        assertThat(response.user().orgId()).isEqualTo("org-a");
        assertThat(response.refreshToken()).isNotNull();
    }

    @Test
    void login_multipleMemberships_prefersOrgMatchingAccountHint() {
        var u = user("u-1", "a@example.com");
        u.setOrgId("org-b"); // the login-default hint, written only by register()
        when(repo.findByEmail("a@example.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        var older = membership("u-1", "org-a", Role.VIEWER, Instant.now().minusSeconds(1000));
        var hinted = membership("u-1", "org-b", Role.ADMIN, Instant.now());
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(List.of(older, hinted));

        var response = service.login(new LoginRequest("a@example.com", "pw"));

        assertThat(response.user().orgId()).isEqualTo("org-b");
    }

    @Test
    void login_multipleMembershipsNoValidHint_fallsBackToEarliestCreated() {
        var u = user("u-1", "a@example.com");
        u.setOrgId("org-stale-and-gone"); // hint doesn't match any current membership
        when(repo.findByEmail("a@example.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        var older = membership("u-1", "org-a", Role.VIEWER, Instant.now().minusSeconds(1000));
        var newer = membership("u-1", "org-b", Role.ADMIN, Instant.now());
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(List.of(newer, older));

        var response = service.login(new LoginRequest("a@example.com", "pw"));

        assertThat(response.user().orgId()).isEqualTo("org-a");
    }

    @Test
    void login_zeroActiveMemberships_returnsNoOrgContextAndNoRefreshToken() {
        var u = user("u-1", "a@example.com");
        when(repo.findByEmail("a@example.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(List.of());

        var response = service.login(new LoginRequest("a@example.com", "pw"));

        assertThat(response.user().orgId()).isNull();
        assertThat(response.refreshToken()).isNull();
    }

    @Test
    void login_wrongPassword_throwsInvalidCredentials() {
        var u = user("u-1", "a@example.com");
        when(repo.findByEmail("a@example.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("wrong", "hashed-password")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> service.login(new LoginRequest("a@example.com", "wrong")));
    }

    // ----------------------------------------------------------------- refresh() ----

    @Test
    void refresh_validToken_rotatesTokenAndReturnsNewSession() {
        var stored = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(stored));
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-a"))
                .thenReturn(Optional.of(membership("u-1", "org-a", Role.RESPONDER, Instant.now())));
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));

        var response = service.refresh("plain-refresh-token");

        assertThat(response.user().orgId()).isEqualTo("org-a");
        assertThat(response.user().role()).isEqualTo("RESPONDER");
        assertThat(stored.isRevoked()).isTrue();
    }

    @Test
    void refresh_revokedToken_throwsInvalidRefreshToken() {
        var stored = refreshToken("u-1", "org-a", "hash");
        stored.setRevoked(true);
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(stored));

        assertThrows(InvalidRefreshTokenException.class, () -> service.refresh("plain-refresh-token"));
    }

    @Test
    void refresh_expiredToken_throwsInvalidRefreshToken() {
        var stored = refreshToken("u-1", "org-a", "hash");
        stored.setExpiresAt(Instant.now().minusSeconds(10));
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(stored));

        assertThrows(InvalidRefreshTokenException.class, () -> service.refresh("plain-refresh-token"));
    }

    @Test
    void refresh_membershipNoLongerActive_throwsMembershipInactiveDistinctFromInvalidToken() {
        var stored = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(stored));
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-a")).thenReturn(Optional.empty());

        assertThrows(MembershipInactiveException.class, () -> service.refresh("plain-refresh-token"));
    }

    // --------------------------------------------------------------- switchOrg() ----

    @Test
    void switchOrg_validSessionAndTargetMembership_succeeds() {
        var current = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(current));
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-b"))
                .thenReturn(Optional.of(membership("u-1", "org-b", Role.ADMIN, Instant.now())));
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));

        var response = service.switchOrg("u-1", "org-a", "org-b", "plain-token");

        assertThat(response.user().orgId()).isEqualTo("org-b");
        assertThat(current.isRevoked()).isTrue();
    }

    @Test
    void switchOrg_presentedRefreshTokenBelongsToAnotherOrg_rejectedNotLaundered() {
        // Simulates presenting a DIFFERENT session's refresh token (pinned to org-c, not
        // the caller's claimed currentOrgId org-a) — this is exactly the "stolen access
        // token laundered into a fresh 30-day refresh session" attack switchOrg() must
        // reject before ever touching the target membership.
        var otherSessionToken = refreshToken("u-1", "org-c", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(otherSessionToken));

        assertThrows(InvalidRefreshTokenException.class,
                () -> service.switchOrg("u-1", "org-a", "org-b", "plain-token"));
        verify(membershipRepo, never()).findByUserIdAndOrgId("u-1", "org-b");
        assertThat(otherSessionToken.isRevoked()).isFalse();
    }

    @Test
    void switchOrg_notAMemberOfTargetOrg_throwsNotOrgMember() {
        var current = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(current));
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-b")).thenReturn(Optional.empty());

        assertThrows(NotOrgMemberException.class, () -> service.switchOrg("u-1", "org-a", "org-b", "plain-token"));
    }

    // ------------------------------------------------ createOrgForExistingUser() ----

    @Test
    void createOrgForExistingUser_withActiveMembershipElsewhere_requiresValidRefreshToken() {
        when(membershipRepo.existsByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(true);

        assertThrows(InvalidRefreshTokenException.class,
                () -> service.createOrgForExistingUser("u-1", "org-a", null, "New Org"));
        verify(orgClient, never()).provision(anyString(), any());
    }

    @Test
    void createOrgForExistingUser_withActiveMembershipAndValidToken_revokesOldTokenAndProvisionsNewOrg() {
        when(membershipRepo.existsByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(true);
        var current = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(current));
        when(orgClient.provision(anyString(), any())).thenReturn(new OrgClient.OrgDto("org-new", "New Org", "s", "now"));
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));

        var response = service.createOrgForExistingUser("u-1", "org-a", "plain-token", "New Org");

        assertThat(response.user().role()).isEqualTo("ADMIN");
        assertThat(current.isRevoked()).isTrue();
        verify(orgClient).provision(anyString(), any());
    }

    @Test
    void createOrgForExistingUser_zeroActiveMemberships_needsNoRefreshTokenAtAll() {
        when(membershipRepo.existsByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(false);
        when(orgClient.provision(anyString(), any())).thenReturn(new OrgClient.OrgDto("org-new", "New Org", "s", "now"));
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));

        var response = service.createOrgForExistingUser("u-1", null, null, "New Org");

        assertThat(response.user().role()).isEqualTo("ADMIN");
        verify(refreshTokenRepo, never()).findByTokenHashForUpdate(anyString());
    }

    @Test
    void createOrgForExistingUser_blankOrgName_throwsBadRequestBeforeAnyLookup() {
        var ex = assertThrows(ApiException.class,
                () -> service.createOrgForExistingUser("u-1", "org-a", "token", "   "));

        assertThat(ex.getMessage()).contains("Organization name is required");
        verify(membershipRepo, never()).existsByUserIdAndStatus(anyString(), any());
    }

    // ---------------------------------------------------------- leaveOrganization() ----

    @Test
    void leaveOrganization_anotherActiveOrgRemains_returnsSwitchedSessionNotAccountDeleted() {
        var current = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(current));
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-a"))
                .thenReturn(Optional.of(membership("u-1", "org-a", Role.RESPONDER, Instant.now())));
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists("u-1", "org-a")).thenReturn(1);
        var remaining = membership("u-1", "org-b", Role.VIEWER, Instant.now());
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(List.of(remaining));
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));

        var response = service.leaveOrganization("u-1", "org-a", "org-a", "plain-token");

        assertThat(response.accountDeleted()).isFalse();
        assertThat(response.hasRemainingOrg()).isTrue();
        assertThat(response.session().user().orgId()).isEqualTo("org-b");
        verify(repo, never()).deleteById(anyString());
    }

    @Test
    void leaveOrganization_noRemainingOrgs_deletesAccountAndRevokesEverything() {
        var current = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(current));
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-a"))
                .thenReturn(Optional.of(membership("u-1", "org-a", Role.RESPONDER, Instant.now())));
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists("u-1", "org-a")).thenReturn(1);
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(List.of());

        var response = service.leaveOrganization("u-1", "org-a", "org-a", "plain-token");

        assertThat(response.accountDeleted()).isTrue();
        assertThat(response.hasRemainingOrg()).isFalse();
        assertThat(response.session()).isNull();
        verify(repo).deleteById("u-1");
        verify(refreshTokenRepo).deleteByUserId("u-1");
    }

    @Test
    void leaveOrganization_soleAdmin_throwsLastAdminExceptionBeforeAnyMutation() {
        var current = refreshToken("u-1", "org-a", "hash");
        when(refreshTokenRepo.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(current));
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-a"))
                .thenReturn(Optional.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));

        assertThrows(LastAdminException.class, () -> service.leaveOrganization("u-1", "org-a", "org-a", "plain-token"));
        verify(membershipRepo, never()).deleteByUserIdAndOrgIdIfExists(anyString(), anyString());
    }

    @Test
    void leaveOrganization_targetOrgNotCurrentOrg_throwsNotOrgMember() {
        assertThrows(NotOrgMemberException.class,
                () -> service.leaveOrganization("u-1", "org-a", "org-different", "plain-token"));
        verify(refreshTokenRepo, never()).findByTokenHashForUpdate(anyString());
    }

    // ------------------------------------------------------------ removeMembership() ----

    @Test
    void removeMembership_userHasAnotherActiveOrg_onlyRevokesThisOrgsSessionsAccountSurvives() {
        when(membershipRepo.findByUserIdAndOrgId("target-user", "org-a"))
                .thenReturn(Optional.of(membership("target-user", "org-a", Role.RESPONDER, Instant.now())));
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists("target-user", "org-a")).thenReturn(1);
        when(membershipRepo.existsByUserIdAndStatus("target-user", MembershipStatus.ACTIVE)).thenReturn(true);

        service.removeMembership("org-a", "target-user");

        verify(repo, never()).deleteById(anyString());
        verify(refreshTokenRepo, never()).deleteByUserId(anyString());
        verify(publisher).publishUserMembershipRemoved(any());
    }

    @Test
    void removeMembership_userHasNoOtherActiveOrg_deletesAccountOutright() {
        when(membershipRepo.findByUserIdAndOrgId("target-user", "org-a"))
                .thenReturn(Optional.of(membership("target-user", "org-a", Role.RESPONDER, Instant.now())));
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists("target-user", "org-a")).thenReturn(1);
        when(membershipRepo.existsByUserIdAndStatus("target-user", MembershipStatus.ACTIVE)).thenReturn(false);

        service.removeMembership("org-a", "target-user");

        verify(repo).deleteById("target-user");
        verify(refreshTokenRepo).deleteByUserId("target-user");
    }

    @Test
    void removeMembership_concurrentlyAlreadyRemoved_isIdempotentNoDuplicateEventOrAccountTouch() {
        when(membershipRepo.findByUserIdAndOrgId("target-user", "org-a"))
                .thenReturn(Optional.of(membership("target-user", "org-a", Role.RESPONDER, Instant.now())));
        // Someone else's concurrent request already deleted the row -> affectedRows == 0.
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists("target-user", "org-a")).thenReturn(0);

        service.removeMembership("org-a", "target-user");

        verify(publisher, never()).publishUserMembershipRemoved(any());
        verify(repo, never()).deleteById(anyString());
        verify(membershipRepo, never()).existsByUserIdAndStatus(anyString(), any());
    }

    @Test
    void removeMembership_lastAdmin_throwsAndNeverDeletes() {
        when(membershipRepo.findByUserIdAndOrgId("admin-user", "org-a"))
                .thenReturn(Optional.of(membership("admin-user", "org-a", Role.ADMIN, Instant.now())));
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(membership("admin-user", "org-a", Role.ADMIN, Instant.now())));

        assertThrows(LastAdminException.class, () -> service.removeMembership("org-a", "admin-user"));
        verify(membershipRepo, never()).deleteByUserIdAndOrgIdIfExists(anyString(), anyString());
    }

    // ------------------------------------------------------------ deleteOrganization() ----

    @Test
    void deleteOrganization_wrongPassword_throwsBeforeCheckingAdminStatus() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("wrong", "hashed-password")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> service.deleteOrganization("u-1", "org-a", "wrong"));
        verify(membershipRepo, never()).findByOrgIdAndStatusAndRoleForUpdate(anyString(), any(), any());
    }

    @Test
    void deleteOrganization_callerNotSoleAdmin_throwsAndNeverCallsOrgService() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(
                        membership("u-1", "org-a", Role.ADMIN, Instant.now()),
                        membership("u-2", "org-a", Role.ADMIN, Instant.now())));

        assertThrows(NotSoleAdminException.class, () -> service.deleteOrganization("u-1", "org-a", "pw"));
        verify(orgClient, never()).delete(anyString());
    }

    @Test
    void deleteOrganization_soleAdmin_callsOrgServiceBeforeAnyLocalMembershipDeletion() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));
        var soleMembership = membership("u-1", "org-a", Role.ADMIN, Instant.now());
        when(membershipRepo.findByOrgId("org-a")).thenReturn(List.of(soleMembership));
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists("u-1", "org-a")).thenReturn(1);
        when(membershipRepo.existsByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(false);
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(List.of());

        var response = service.deleteOrganization("u-1", "org-a", "pw");

        verify(orgClient).delete("org-a");
        assertThat(response.accountDeleted()).isTrue();
        verify(repo).deleteById("u-1");
        verify(refreshTokenRepo).deleteByOrgId("org-a");
    }

    @Test
    void deleteOrganization_soleAdminWithAnotherOrg_accountSurvivesAndSessionSwitches() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));
        when(membershipRepo.findByOrgId("org-a")).thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists("u-1", "org-a")).thenReturn(1);
        // Caller still belongs to org-b -> account survives, only org-a's session dies.
        when(membershipRepo.existsByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(true);
        var remaining = membership("u-1", "org-b", Role.VIEWER, Instant.now());
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE)).thenReturn(List.of(remaining));

        var response = service.deleteOrganization("u-1", "org-a", "pw");

        assertThat(response.accountDeleted()).isFalse();
        assertThat(response.hasRemainingOrg()).isTrue();
        assertThat(response.session().user().orgId()).isEqualTo("org-b");
        verify(repo, never()).deleteById(anyString());
    }

    // ------------------------------------------------------------------ deleteAccount() ----

    @Test
    void deleteAccount_soleAdminOfAnOrg_throwsBeforeMutatingAnything() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(membership("u-1", "org-a", Role.ADMIN, Instant.now())));

        assertThrows(LastAdminException.class, () -> service.deleteAccount("u-1", "pw"));
        verify(membershipRepo, never()).findByUserId(anyString());
        verify(repo, never()).deleteById(anyString());
    }

    @Test
    void deleteAccount_success_cascadesEveryMembershipRegardlessOfStatus() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("pw", "hashed-password")).thenReturn(true);
        when(membershipRepo.findByUserIdAndStatus("u-1", MembershipStatus.ACTIVE))
                .thenReturn(List.of(membership("u-1", "org-a", Role.RESPONDER, Instant.now())));
        when(membershipRepo.findByUserId("u-1")).thenReturn(List.of(
                membership("u-1", "org-a", Role.RESPONDER, Instant.now()),
                membership("u-1", "org-b", Role.VIEWER, Instant.now())));
        when(membershipRepo.deleteByUserIdAndOrgIdIfExists(eq("u-1"), anyString())).thenReturn(1);

        service.deleteAccount("u-1", "pw");

        verify(membershipRepo, times(2)).deleteByUserIdAndOrgIdIfExists(eq("u-1"), anyString());
        verify(repo).deleteById("u-1");
        verify(refreshTokenRepo).deleteByUserId("u-1");
    }

    @Test
    void deleteAccount_wrongPassword_throwsAndTouchesNothing() {
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));
        when(passwordEncoder.matches("wrong", "hashed-password")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> service.deleteAccount("u-1", "wrong"));
        verify(membershipRepo, never()).findByUserIdAndStatus(anyString(), any());
    }

    // -------------------------------------------------------------- updateRole() ----

    @Test
    void updateRole_demotingSoleAdmin_throwsLastAdminAndDoesNotChangeRole() {
        var m = membership("u-1", "org-a", Role.ADMIN, Instant.now());
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-a")).thenReturn(Optional.of(m));
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(m));

        assertThrows(LastAdminException.class, () -> service.updateRole("org-a", "u-1", "VIEWER"));
        assertThat(m.getRole()).isEqualTo(Role.ADMIN);
        verify(membershipRepo, never()).save(any());
    }

    @Test
    void updateRole_demotingOneOfTwoAdmins_succeeds() {
        var m = membership("u-1", "org-a", Role.ADMIN, Instant.now());
        when(membershipRepo.findByUserIdAndOrgId("u-1", "org-a")).thenReturn(Optional.of(m));
        when(membershipRepo.findByOrgIdAndStatusAndRoleForUpdate("org-a", MembershipStatus.ACTIVE, Role.ADMIN))
                .thenReturn(List.of(m, membership("u-2", "org-a", Role.ADMIN, Instant.now())));
        when(repo.findById("u-1")).thenReturn(Optional.of(user("u-1", "a@example.com")));

        var response = service.updateRole("org-a", "u-1", "VIEWER");

        assertThat(response.role()).isEqualTo("VIEWER");
        assertThat(m.getRole()).isEqualTo(Role.VIEWER);
        verify(membershipRepo).save(m);
        verify(publisher).publishUserRoleChanged(any());
    }

    // -------------------------------------------------------------- acceptInvitation() ----

    @Test
    void acceptInvitation_emailMismatch_throwsBeforeCreatingMembership() {
        var invitation = new Invitation("inv-1", "org-a", "invited@example.com", Role.RESPONDER,
                "hash", "admin-1", Instant.now().plusSeconds(3600), Instant.now(), false, false);
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(invitation));
        when(repo.findById("caller-id")).thenReturn(Optional.of(user("caller-id", "someone-else@example.com")));

        assertThrows(io.incidentops.auth.exception.InvitationEmailMismatchException.class,
                () -> service.acceptInvitation("caller-id", "org-current", "token", "refresh"));
        verify(membershipRepo, never()).save(any());
    }

    @Test
    void acceptInvitation_alreadyAMember_throwsAlreadyOrgMember() {
        var invitation = new Invitation("inv-1", "org-a", "same@example.com", Role.RESPONDER,
                "hash", "admin-1", Instant.now().plusSeconds(3600), Instant.now(), false, false);
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.of(invitation));
        when(repo.findById("caller-id")).thenReturn(Optional.of(user("caller-id", "same@example.com")));
        when(membershipRepo.existsByUserIdAndOrgId("caller-id", "org-a")).thenReturn(true);

        assertThrows(AlreadyOrgMemberException.class,
                () -> service.acceptInvitation("caller-id", "org-current", "token", "refresh"));
    }

    @Test
    void acceptInvitation_invalidToken_throwsInvalidInvitation() {
        when(invitationRepo.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThrows(InvalidInvitationException.class,
                () -> service.acceptInvitation("caller-id", "org-current", "bad-token", "refresh"));
    }
}
