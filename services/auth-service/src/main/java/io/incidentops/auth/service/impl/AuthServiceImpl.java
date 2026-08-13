package io.incidentops.auth.service.impl;

import io.incidentops.auth.client.OrgClient;
import io.incidentops.auth.dto.event.OrgDeletedPayload;
import io.incidentops.auth.dto.event.UserMembershipRemovedPayload;
import io.incidentops.auth.dto.event.UserRegisteredPayload;
import io.incidentops.auth.dto.event.UserRoleChangedPayload;
import io.incidentops.auth.dto.request.CreateClientRequest;
import io.incidentops.auth.dto.request.LoginRequest;
import io.incidentops.auth.dto.request.RegisterRequest;
import io.incidentops.auth.dto.response.AuthResponse;
import io.incidentops.auth.dto.response.ClientResponse;
import io.incidentops.auth.dto.response.ClientSecretResponse;
import io.incidentops.auth.dto.response.DeleteOrganizationResponse;
import io.incidentops.auth.dto.response.InvitationPreviewResponse;
import io.incidentops.auth.dto.response.InvitationResponse;
import io.incidentops.auth.dto.response.LeaveOrganizationResponse;
import io.incidentops.auth.dto.response.MembershipResponse;
import io.incidentops.auth.dto.response.OrgSummaryResponse;
import io.incidentops.auth.dto.response.TokenResponse;
import io.incidentops.auth.dto.response.UserAccountResponse;
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
import io.incidentops.auth.exception.EmailAlreadyExistsException;
import io.incidentops.auth.exception.InvalidClientException;
import io.incidentops.auth.exception.InvalidCredentialsException;
import io.incidentops.auth.exception.InvalidInvitationException;
import io.incidentops.auth.exception.InvalidPasswordResetTokenException;
import io.incidentops.auth.exception.InvalidRefreshTokenException;
import io.incidentops.auth.exception.InvitationAlreadyAcceptedException;
import io.incidentops.auth.exception.InvitationAlreadyPendingException;
import io.incidentops.auth.exception.InvitationEmailMismatchException;
import io.incidentops.auth.exception.InvitationExpiredException;
import io.incidentops.auth.exception.InvitationNotFoundException;
import io.incidentops.auth.exception.LastAdminException;
import io.incidentops.auth.exception.MembershipInactiveException;
import io.incidentops.auth.exception.NotOrgMemberException;
import io.incidentops.auth.exception.NotSoleAdminException;
import io.incidentops.auth.exception.UserNotFoundException;
import io.incidentops.auth.mail.InvitationMailer;
import io.incidentops.auth.mail.PasswordResetMailer;
import io.incidentops.auth.mapper.AuthMapper;
import io.incidentops.auth.repository.InvitationRepository;
import io.incidentops.auth.repository.MembershipRepository;
import io.incidentops.auth.repository.PasswordResetTokenRepository;
import io.incidentops.auth.repository.RefreshTokenRepository;
import io.incidentops.auth.repository.ServiceClientRepository;
import io.incidentops.auth.repository.UserAccountRepository;
import io.incidentops.auth.service.AuthService;
import io.incidentops.auth.util.Constants;
import io.incidentops.auth.util.TokenHasher;
import io.incidentops.common.aspect.Audited;
import io.incidentops.common.exception.ApiException;
import io.incidentops.common.model.Provider;
import io.incidentops.common.model.ProviderMetadata;
import io.incidentops.common.security.Role;
import io.incidentops.common.security.Scope;
import io.incidentops.common.security.JwtUtil;
import io.incidentops.common.security.SessionKeys;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthServiceImpl implements AuthService {
    private final UserAccountRepository repo;
    private final ServiceClientRepository serviceClientRepo;
    private final RefreshTokenRepository refreshTokenRepo;
    private final PasswordResetTokenRepository resetTokenRepo;
    private final InvitationRepository invitationRepo;
    private final MembershipRepository membershipRepo;
    private final PasswordResetMailer mailer;
    private final InvitationMailer invitationMailer;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthMapper mapper;
    private final AuthEventPublisher publisher;
    private final StringRedisTemplate redis;
    private final OrgClient orgClient;

    public AuthServiceImpl(UserAccountRepository repo, ServiceClientRepository serviceClientRepo,
                            RefreshTokenRepository refreshTokenRepo, PasswordResetTokenRepository resetTokenRepo,
                            InvitationRepository invitationRepo, MembershipRepository membershipRepo,
                            PasswordResetMailer mailer, InvitationMailer invitationMailer,
                            PasswordEncoder passwordEncoder, JwtUtil jwtUtil, AuthMapper mapper,
                            AuthEventPublisher publisher, StringRedisTemplate redis, OrgClient orgClient) {
        this.repo = repo;
        this.serviceClientRepo = serviceClientRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.resetTokenRepo = resetTokenRepo;
        this.invitationRepo = invitationRepo;
        this.membershipRepo = membershipRepo;
        this.mailer = mailer;
        this.invitationMailer = invitationMailer;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.mapper = mapper;
        this.publisher = publisher;
        this.redis = redis;
        this.orgClient = orgClient;
    }

    @Override
    @Transactional
    @Audited(action = "USER_REGISTERED", entityType = "UserAccount")
    public AuthResponse register(RegisterRequest request) {
        if (repo.findByEmail(request.email()).isPresent()) {
            throw new EmailAlreadyExistsException(request.email());
        }

        String orgId;
        Role role;
        Invitation invitation = null;
        if (request.inviteToken() != null && !request.inviteToken().isBlank()) {
            invitation = invitationRepo.findByTokenHash(TokenHasher.sha256Hex(request.inviteToken()))
                    .filter(i -> i.getEmail().equalsIgnoreCase(request.email()))
                    .orElseThrow(InvalidInvitationException::new);
            if (invitation.isRevoked()) throw new InvalidInvitationException();
            if (invitation.isAccepted()) throw new InvitationAlreadyAcceptedException();
            if (invitation.getExpiresAt().isBefore(Instant.now())) throw new InvitationExpiredException();
            orgId = invitation.getOrgId();
            role = invitation.getRole();
        } else if (request.orgId() != null && !request.orgId().isBlank()) {
            // Explicit orgId: not a supported public onboarding mechanism — kept only for
            // VERIFY.md tooling compatibility (its documented curl flow always passes
            // orgId explicitly), deliberately unreachable from the web UI (RegisterPage.tsx
            // no longer exposes an orgId field). Joins-or-bootstraps that specific named org.
            orgId = request.orgId();
            role = membershipRepo.existsByOrgId(orgId) ? Constants.DEFAULT_ROLE : Constants.BOOTSTRAP_ORG_ROLE;
        } else {
            // Neither invite nor explicit orgId — the only path the web UI can reach
            // (RegisterPage → WelcomePage). The account is only ever created together
            // with a real, named org, in one atomic step — there is no "register now,
            // name an org later" state, and therefore no orphaned account left behind by
            // an abandoned WelcomePage. The org is provisioned in org-service FIRST,
            // before any local write: if that call fails (duplicate id — vanishingly
            // unlikely for a fresh UUID — or org-service being unreachable), this whole
            // method throws before repo.save(user) ever runs, so nothing is left behind.
            if (request.orgName() == null || request.orgName().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Registration requires either an invite token or an organization name");
            }
            orgId = UUID.randomUUID().toString();
            role = Role.ADMIN;
            orgClient.provision(orgId, new OrgClient.ProvisionOrgRequest(request.orgName().trim(), null));
        }

        var user = new UserAccount(UUID.randomUUID().toString(), request.email(), request.name(),
                passwordEncoder.encode(request.password()), orgId, role, Instant.now());
        repo.save(user);
        membershipRepo.save(new Membership(UUID.randomUUID().toString(), user.getId(), orgId, role,
                MembershipStatus.ACTIVE, Instant.now()));
        if (invitation != null) {
            // Someone else could have redeemed/revoked it between the check above and now.
            if (invitationRepo.markAcceptedIfPending(invitation.getId()) == 0) {
                throw new InvitationAlreadyAcceptedException();
            }
        }
        publisher.publishUserRegistered(new UserRegisteredPayload(
                user.getId(), user.getEmail(), user.getName(), orgId, role.name()));
        String token = jwtUtil.issue(user.getId(), orgId, role.name(), Constants.USER_TOKEN_TTL_SECONDS, List.of(),
                registerSession(user.getId(), orgId));
        return mapper.toAuthResponse(user, orgId, role.name(), token, issueRefreshToken(user.getId(), orgId));
    }

    /** The only place UserAccount.orgId/role (the transitional login-default hint) is
     *  ever read — never authoritative for an existing session, just a starting guess for
     *  which of a brand-new login's ACTIVE memberships to land in. */
    @Override
    public AuthResponse login(LoginRequest request) {
        var user = repo.findByEmail(request.email()).orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        var activeMemberships = membershipRepo.findByUserIdAndStatus(user.getId(), MembershipStatus.ACTIVE);
        var target = selectDefaultMembership(user, activeMemberships);
        if (target == null) {
            // Zero ACTIVE memberships: land with no org context, no refresh token — same
            // "access-token-only" shape as leaveOrganization()'s zero-remaining branch.
            // The frontend renders the "zero organizations" state (Topbar item 16).
            String token = jwtUtil.issue(user.getId(), "", "", Constants.USER_TOKEN_TTL_SECONDS, List.of(),
                    registerSession(user.getId(), ""));
            return mapper.toAuthResponse(user, null, null, token, null);
        }
        String token = jwtUtil.issue(user.getId(), target.getOrgId(), target.getRole().name(), Constants.USER_TOKEN_TTL_SECONDS,
                List.of(), registerSession(user.getId(), target.getOrgId()));
        return mapper.toAuthResponse(user, target.getOrgId(), target.getRole().name(), token,
                issueRefreshToken(user.getId(), target.getOrgId()));
    }

    private Membership selectDefaultMembership(UserAccount user, List<Membership> activeMemberships) {
        if (activeMemberships.isEmpty()) return null;
        if (activeMemberships.size() == 1) return activeMemberships.get(0);
        if (user.getOrgId() != null) {
            for (var m : activeMemberships) {
                if (m.getOrgId().equals(user.getOrgId())) return m;
            }
        }
        return activeMemberships.stream().min(Comparator.comparing(Membership::getCreatedAt)).orElseThrow();
    }

    @Override
    @Transactional
    public AuthResponse refresh(String refreshToken) {
        var stored = refreshTokenRepo.findByTokenHashForUpdate(TokenHasher.sha256Hex(refreshToken))
                .orElseThrow(InvalidRefreshTokenException::new);
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidRefreshTokenException();
        }
        var membership = membershipRepo.findByUserIdAndOrgId(stored.getUserId(), stored.getOrgId())
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(MembershipInactiveException::new);
        stored.setRevoked(true);
        refreshTokenRepo.save(stored);
        var user = repo.findById(stored.getUserId()).orElseThrow(InvalidCredentialsException::new);
        String newAccessToken = jwtUtil.issue(user.getId(), stored.getOrgId(), membership.getRole().name(), Constants.USER_TOKEN_TTL_SECONDS,
                List.of(), registerSession(user.getId(), stored.getOrgId()));
        return mapper.toAuthResponse(user, stored.getOrgId(), membership.getRole().name(), newAccessToken,
                issueRefreshToken(user.getId(), stored.getOrgId()));
    }

    @Override
    public void logout(String refreshToken) {
        refreshTokenRepo.findByTokenHash(TokenHasher.sha256Hex(refreshToken)).ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokenRepo.save(rt);
        });
    }

    private String issueRefreshToken(String userId, String orgId) {
        String plain = TokenHasher.newOpaqueToken();
        var rt = new RefreshToken(UUID.randomUUID().toString(), userId, orgId, TokenHasher.sha256Hex(plain),
                Instant.now().plusSeconds(Constants.REFRESH_TOKEN_TTL_SECONDS), false);
        refreshTokenRepo.save(rt);
        return plain;
    }

    /** Mints a fresh session id, records it in Redis (session:<sid> -> orgId, TTL matching
     *  the access token it backs) and indexes it under this user (user-sessions:<userId>,
     *  TTL refreshed to the refresh-token lifetime), then returns the sid to embed in the
     *  access token's "sid" claim. Called once per real, user-facing token issuance —
     *  every jwtUtil.issue() call site in this class except the service/client_credentials
     *  branch. This is what lets the gateway immediately reject a still-unexpired access
     *  token once its underlying membership/account/org is gone (see revokeSessionsForOrg/
     *  revokeAllSessions below), instead of waiting up to USER_TOKEN_TTL_SECONDS for it to
     *  expire on its own. */
    private String registerSession(String userId, String orgId) {
        String sid = UUID.randomUUID().toString();
        redis.opsForValue().set(SessionKeys.session(sid), orgId == null ? "" : orgId,
                Duration.ofSeconds(Constants.USER_TOKEN_TTL_SECONDS));
        redis.opsForSet().add(SessionKeys.userSessions(userId), sid);
        redis.expire(SessionKeys.userSessions(userId), Duration.ofSeconds(Constants.REFRESH_TOKEN_TTL_SECONDS));
        return sid;
    }

    /** Immediately revokes every session this user currently holds for one specific org —
     *  sessions for any *other* org the user belongs to are left untouched, preserving the
     *  same multi-session-isolation guarantee switchOrg()/refresh() already rely on. Used
     *  when a single membership disappears (admin removal, self-service leave, or org
     *  deletion for a user who still belongs to other orgs). Best-effort against Redis —
     *  not part of the JDBC transaction (same non-transactional-side-effect treatment this
     *  class already gives its other Redis usage), so a Redis failure here doesn't roll
     *  back the membership deletion itself; the MEMBERSHIP_INACTIVE-on-next-refresh path
     *  remains as a fallback if this doesn't fire. */
    private void revokeSessionsForOrg(String userId, String orgId) {
        String setKey = SessionKeys.userSessions(userId);
        Set<String> sids = redis.opsForSet().members(setKey);
        if (sids == null) return;
        for (String sid : sids) {
            String sessionKey = SessionKeys.session(sid);
            if (orgId.equals(redis.opsForValue().get(sessionKey))) {
                redis.delete(sessionKey);
                redis.opsForSet().remove(setKey, sid);
            }
        }
    }

    /** Immediately revokes every session this user holds, across every org — used when the
     *  account itself is deleted (self-service deleteAccount, or cascaded by deleteOrganization
     *  when the caller/an affected member has no remaining ACTIVE membership anywhere).
     *  Same best-effort-against-Redis caveat as revokeSessionsForOrg. */
    private void revokeAllSessions(String userId) {
        String setKey = SessionKeys.userSessions(userId);
        Set<String> sids = redis.opsForSet().members(setKey);
        if (sids != null) {
            for (String sid : sids) redis.delete(SessionKeys.session(sid));
        }
        redis.delete(setKey);
    }

    @Override
    @Transactional
    public AuthResponse createOrgForExistingUser(String userId, String currentOrgId, String currentRefreshToken, String orgName) {
        if (orgName == null || orgName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Organization name is required");
        }
        boolean hasActiveMembership = membershipRepo.existsByUserIdAndStatus(userId, MembershipStatus.ACTIVE);
        if (hasActiveMembership) {
            // Strict path: same session-transition requirement as switchOrg() — without
            // it, a still-valid access token alone could mint a fresh 30-day refresh token.
            if (currentRefreshToken == null || currentRefreshToken.isBlank()) throw new InvalidRefreshTokenException();
            var currentToken = refreshTokenRepo.findByTokenHashForUpdate(TokenHasher.sha256Hex(currentRefreshToken))
                    .filter(rt -> !rt.isRevoked() && rt.getExpiresAt().isAfter(Instant.now()))
                    .filter(rt -> rt.getUserId().equals(userId) && rt.getOrgId().equals(currentOrgId))
                    .orElseThrow(InvalidRefreshTokenException::new);
            currentToken.setRevoked(true);
            refreshTokenRepo.save(currentToken);
        }
        // Zero-ACTIVE-membership caller (none at all, or SUSPENDED-only): no token to
        // validate or revoke, proceed directly — no laundering risk, no existing
        // org-scoped session to pivot out of.
        var orgId = UUID.randomUUID().toString();
        // Provisioned atomically, same pattern as register()'s WelcomePage branch: org-service
        // is called FIRST, before any local write. If it throws (duplicate id — vanishingly
        // unlikely for a fresh UUID — or org-service unreachable), this whole method throws
        // before the Membership is ever saved, so nothing local is left behind. An earlier
        // version created an unnamed Membership first and asked for a name in a second call —
        // that left orphaned, permanently-unnamed orgs behind on an abandoned/retried flow.
        orgClient.provision(orgId, new OrgClient.ProvisionOrgRequest(orgName.trim(), null));
        membershipRepo.save(new Membership(UUID.randomUUID().toString(), userId, orgId, Role.ADMIN,
                MembershipStatus.ACTIVE, Instant.now()));
        var user = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        // Same semantic-reuse convention as acceptInvitation(): this is the only signal
        // user-service gets that a (userId, orgId) directory row should exist for this
        // brand-new org — without it, the account would never appear in this org's
        // user-service-backed lookups. Now the primary org-provisioning path for every
        // fresh web registration (via WelcomePage), not just the rare "add another org"
        // case, so this omission would otherwise affect every new signup.
        publisher.publishUserRegistered(new UserRegisteredPayload(
                user.getId(), user.getEmail(), user.getName(), orgId, Role.ADMIN.name()));
        String token = jwtUtil.issue(userId, orgId, Role.ADMIN.name(), Constants.USER_TOKEN_TTL_SECONDS,
                List.of(), registerSession(userId, orgId));
        return mapper.toAuthResponse(user, orgId, Role.ADMIN.name(), token, issueRefreshToken(userId, orgId));
    }

    @Override
    @Transactional
    public AuthResponse switchOrg(String userId, String currentOrgId, String orgId, String currentRefreshToken) {
        var currentToken = refreshTokenRepo.findByTokenHashForUpdate(TokenHasher.sha256Hex(currentRefreshToken))
                .filter(rt -> !rt.isRevoked() && rt.getExpiresAt().isAfter(Instant.now()))
                .filter(rt -> rt.getUserId().equals(userId))
                .filter(rt -> rt.getOrgId().equals(currentOrgId))
                .orElseThrow(InvalidRefreshTokenException::new);
        var membership = membershipRepo.findByUserIdAndOrgId(userId, orgId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(NotOrgMemberException::new);
        currentToken.setRevoked(true);
        refreshTokenRepo.save(currentToken);
        var user = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        String token = jwtUtil.issue(userId, orgId, membership.getRole().name(), Constants.USER_TOKEN_TTL_SECONDS,
                List.of(), registerSession(userId, orgId));
        return mapper.toAuthResponse(user, orgId, membership.getRole().name(), token, issueRefreshToken(userId, orgId));
    }

    @Override
    public List<MembershipResponse> myOrgs(String userId) {
        return membershipRepo.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE).stream()
                .map(m -> new MembershipResponse(m.getOrgId(), resolveOrgName(m.getOrgId()), m.getRole().name()))
                .toList();
    }

    @Override
    @Transactional
    public AuthResponse acceptInvitation(String userId, String currentOrgId, String token, String currentRefreshToken) {
        var invitation = invitationRepo.findByTokenHash(TokenHasher.sha256Hex(token))
                .orElseThrow(InvalidInvitationException::new);
        if (invitation.isRevoked()) throw new InvalidInvitationException();
        if (invitation.isAccepted()) throw new InvitationAlreadyAcceptedException();
        if (invitation.getExpiresAt().isBefore(Instant.now())) throw new InvitationExpiredException();

        var caller = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        if (!caller.getEmail().equalsIgnoreCase(invitation.getEmail())) {
            throw new InvitationEmailMismatchException();
        }
        if (membershipRepo.existsByUserIdAndOrgId(userId, invitation.getOrgId())) {
            throw new AlreadyOrgMemberException();
        }
        if (invitationRepo.markAcceptedIfPending(invitation.getId()) == 0) {
            throw new InvitationAlreadyAcceptedException();
        }
        membershipRepo.save(new Membership(UUID.randomUUID().toString(), userId, invitation.getOrgId(),
                invitation.getRole(), MembershipStatus.ACTIVE, Instant.now()));

        // Same required-precondition pattern as switchOrg() — accepting rotates the
        // session's active org exactly like a switch does, for the identical
        // laundering-prevention reason. A caller with a valid access token but a dead
        // refresh token must log in again first (Option A — see the plan's Backend item 7).
        var currentToken = refreshTokenRepo.findByTokenHashForUpdate(TokenHasher.sha256Hex(currentRefreshToken))
                .filter(rt -> !rt.isRevoked() && rt.getExpiresAt().isAfter(Instant.now()))
                .filter(rt -> rt.getUserId().equals(userId) && rt.getOrgId().equals(currentOrgId))
                .orElseThrow(InvalidRefreshTokenException::new);
        currentToken.setRevoked(true);
        refreshTokenRepo.save(currentToken);

        // Intentional semantic reuse, not a perfect fit: consumers must not treat
        // UserRegistered as proof a brand-new platform account was created — it may also
        // mean an existing account gained a membership in another org. user-service's
        // consumeUserRegistered is already keyed by (userId, orgId) rather than userId
        // alone for exactly this reason.
        publisher.publishUserRegistered(new UserRegisteredPayload(
                caller.getId(), caller.getEmail(), caller.getName(), invitation.getOrgId(), invitation.getRole().name()));

        String newToken = jwtUtil.issue(userId, invitation.getOrgId(), invitation.getRole().name(), Constants.USER_TOKEN_TTL_SECONDS,
                List.of(), registerSession(userId, invitation.getOrgId()));
        return mapper.toAuthResponse(caller, invitation.getOrgId(), invitation.getRole().name(), newToken,
                issueRefreshToken(userId, invitation.getOrgId()));
    }

    @Override
    public List<UserAccountResponse> listUsers(String orgId) {
        var memberships = membershipRepo.findByOrgIdAndStatus(orgId, MembershipStatus.ACTIVE);
        var usersById = repo.findAllById(memberships.stream().map(Membership::getUserId).toList()).stream()
                .collect(Collectors.toMap(UserAccount::getId, u -> u));
        return memberships.stream()
                .map(m -> mapper.toUserAccountResponse(usersById.get(m.getUserId()), m.getRole().name()))
                .toList();
    }

    @Override
    @Transactional
    @Audited(action = "USER_ROLE_CHANGED", entityType = "UserAccount")
    public UserAccountResponse updateRole(String orgId, String userId, String newRole) {
        var membership = membershipRepo.findByUserIdAndOrgId(userId, orgId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(() -> new UserNotFoundException(userId));
        Role parsedRole = Role.parse(newRole);
        if (membership.getRole() == Role.ADMIN && parsedRole != Role.ADMIN) {
            requireNotLastAdmin(orgId, userId, Role.ADMIN);
        }
        membership.setRole(parsedRole);
        membershipRepo.save(membership);
        var user = repo.findById(userId).orElseThrow(() -> new UserNotFoundException(userId));
        // Does not touch UserAccount.orgId/role at all — the affected session picks up
        // the new role on its next refresh (see Architecture Decisions); the hint is
        // written in exactly one place in this whole service (register()) and read in
        // exactly one place (login()'s selectDefaultMembership), nowhere else.
        publisher.publishUserRoleChanged(new UserRoleChangedPayload(userId, orgId, parsedRole.name()));
        return mapper.toUserAccountResponse(user, parsedRole.name());
    }

    @Override
    @Transactional
    public void removeMembership(String orgId, String userId) {
        var membership = membershipRepo.findByUserIdAndOrgId(userId, orgId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(() -> new UserNotFoundException(userId));
        requireNotLastAdmin(orgId, userId, membership.getRole());
        if (membershipRepo.deleteByUserIdAndOrgIdIfExists(userId, orgId) == 1) {
            publishMembershipRemovedAfterCommit(userId, orgId);
            if (membershipRepo.existsByUserIdAndStatus(userId, MembershipStatus.ACTIVE)) {
                revokeSessionsForOrg(userId, orgId);
            } else {
                // No ACTIVE membership left anywhere — same account-deletion cascade
                // deleteOrganization() applies to every affected member: an admin removing
                // someone's last org deletes their account outright, not just this one
                // membership. Historical data they created elsewhere (incidents, comments,
                // audit entries) is untouched — those live in other services' own
                // databases, keyed by a plain userId string, not a real foreign key to
                // this row, so nothing cascades from this delete.
                refreshTokenRepo.deleteByUserId(userId);
                repo.deleteById(userId);
                revokeAllSessions(userId);
            }
        }
    }

    @Override
    @Transactional
    public LeaveOrganizationResponse leaveOrganization(String userId, String currentOrgId, String orgId, String currentRefreshToken) {
        // Only defined/meaningful for leaving the caller's currently-active org — leaving
        // this is itself a session transition, unlike removing someone else's membership.
        if (!orgId.equals(currentOrgId)) {
            throw new NotOrgMemberException();
        }
        var currentToken = refreshTokenRepo.findByTokenHashForUpdate(TokenHasher.sha256Hex(currentRefreshToken))
                .filter(rt -> !rt.isRevoked() && rt.getExpiresAt().isAfter(Instant.now()))
                .filter(rt -> rt.getUserId().equals(userId) && rt.getOrgId().equals(currentOrgId))
                .orElseThrow(InvalidRefreshTokenException::new);
        var membership = membershipRepo.findByUserIdAndOrgId(userId, orgId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(NotOrgMemberException::new);
        requireNotLastAdmin(orgId, userId, membership.getRole());

        if (membershipRepo.deleteByUserIdAndOrgIdIfExists(userId, orgId) == 1) {
            publishMembershipRemovedAfterCommit(userId, orgId);
        }
        currentToken.setRevoked(true);
        refreshTokenRepo.save(currentToken);

        var remaining = membershipRepo.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE);
        if (remaining.isEmpty()) {
            // No ACTIVE membership left anywhere — same account-deletion cascade
            // deleteOrganization() applies: leaving your last org doesn't land you in a
            // "zero organizations, keep your account" limbo state anymore, it deletes the
            // account outright, immediately, session included. (An earlier version left
            // the access token alive here to authorize a "Create organization" bootstrap
            // from the zero-org empty state — that state no longer exists on this path.)
            refreshTokenRepo.deleteByUserId(userId);
            repo.deleteById(userId);
            revokeAllSessions(userId);
            return new LeaveOrganizationResponse(true, false, null);
        }
        revokeSessionsForOrg(userId, orgId);
        var target = remaining.stream().min(Comparator.comparing(Membership::getCreatedAt)).orElseThrow();
        var user = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        String token = jwtUtil.issue(userId, target.getOrgId(), target.getRole().name(), Constants.USER_TOKEN_TTL_SECONDS,
                List.of(), registerSession(userId, target.getOrgId()));
        var session = mapper.toAuthResponse(user, target.getOrgId(), target.getRole().name(), token,
                issueRefreshToken(userId, target.getOrgId()));
        return new LeaveOrganizationResponse(false, true, session);
    }

    /** Shared by updateRole (demotion), removeMembership, and leaveOrganization — locks
     *  the org's ACTIVE ADMIN rows for the rest of this transaction so two concurrent
     *  requests (e.g. two admins demoting each other) can't both observe "not the last
     *  admin" before either commits. A plain no-lock count-then-act check has exactly
     *  that race; this closes it. No-op if the membership being changed isn't ADMIN. */
    private void requireNotLastAdmin(String orgId, String userId, Role currentRole) {
        if (currentRole != Role.ADMIN) return;
        var admins = membershipRepo.findByOrgIdAndStatusAndRoleForUpdate(orgId, MembershipStatus.ACTIVE, Role.ADMIN);
        if (admins.size() == 1 && admins.get(0).getUserId().equals(userId)) {
            throw new LastAdminException();
        }
    }

    /** Kafka isn't a participant in the JDBC transaction — publishing inline, mid-
     *  transaction, would mean a later rollback still leaves a "phantom" removal event
     *  out in the world for a DB change that never happened. Deferring to afterCommit
     *  closes that without building outbox infrastructure (no DB-backed relay/poller —
     *  just Spring's built-in transaction-synchronization hook). Delivery is still only
     *  eventually consistent with the DB change, same accepted limitation as
     *  UserRegistered/UserRoleChanged — a crash between commit and this callback firing
     *  would still lose the event. */
    private void publishMembershipRemovedAfterCommit(String userId, String orgId) {
        var payload = new UserMembershipRemovedPayload(userId, orgId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publisher.publishUserMembershipRemoved(payload);
                }
            });
        } else {
            publisher.publishUserMembershipRemoved(payload);
        }
    }

    @Override
    public OrgSummaryResponse orgSummary(String orgId) {
        long memberCount = membershipRepo.countByOrgIdAndStatus(orgId, MembershipStatus.ACTIVE);
        long adminCount = membershipRepo.countByOrgIdAndStatusAndRole(orgId, MembershipStatus.ACTIVE, Role.ADMIN);
        return new OrgSummaryResponse(orgId, memberCount, adminCount);
    }

    /** Always returns normally whether or not the email exists — the caller must never
     *  be able to tell registered emails apart from unregistered ones from this response. */
    @Override
    public void forgotPassword(String email) {
        repo.findByEmail(email).ifPresent(user -> {
            String plain = TokenHasher.newOpaqueToken();
            var prt = new PasswordResetToken(UUID.randomUUID().toString(), user.getId(), TokenHasher.sha256Hex(plain),
                    Instant.now().plusSeconds(Constants.PASSWORD_RESET_TOKEN_TTL_SECONDS), false);
            resetTokenRepo.save(prt);
            mailer.sendResetLink(user.getEmail(), plain);
        });
    }

    @Override
    public void resetPassword(String token, String newPassword) {
        var stored = resetTokenRepo.findByTokenHash(TokenHasher.sha256Hex(token))
                .orElseThrow(InvalidPasswordResetTokenException::new);
        if (stored.isUsed() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidPasswordResetTokenException();
        }
        var user = repo.findById(stored.getUserId()).orElseThrow(InvalidPasswordResetTokenException::new);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        repo.save(user);
        stored.setUsed(true);
        resetTokenRepo.save(stored);
    }

    @Override
    public void changePassword(String userId, String currentPassword, String newPassword) {
        var user = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        repo.save(user);
    }

    @Override
    @Transactional
    @Audited(action = "USER_ACCOUNT_DELETED", entityType = "UserAccount")
    public void deleteAccount(String userId, String password) {
        var user = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        // Fail fast, before mutating anything, if deleting this account would leave any
        // org without an admin — same guard demotion/removal/leave already use, just
        // applied across every ACTIVE membership instead of one.
        var activeMemberships = membershipRepo.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE);
        for (var m : activeMemberships) {
            requireNotLastAdmin(m.getOrgId(), userId, m.getRole());
        }

        // Any status, not just ACTIVE — a SUSPENDED row would otherwise survive the
        // account it belongs to.
        for (var m : membershipRepo.findByUserId(userId)) {
            if (membershipRepo.deleteByUserIdAndOrgIdIfExists(userId, m.getOrgId()) == 1) {
                publishMembershipRemovedAfterCommit(userId, m.getOrgId());
            }
        }
        refreshTokenRepo.deleteByUserId(userId);
        repo.deleteById(userId);
        revokeAllSessions(userId);
    }

    @Override
    @Transactional
    @Audited(action = "ORG_DELETED", entityType = "Org")
    public DeleteOrganizationResponse deleteOrganization(String userId, String orgId, String password) {
        var caller = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(password, caller.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        // Row-locks the org's ACTIVE ADMIN memberships for the rest of this transaction —
        // same lock requireNotLastAdmin uses, here for the opposite (qualifying, not
        // blocking) check: the caller must actually BE the org's sole admin, not merely
        // not-the-last-one. RESPONDER/VIEWER members, if any, don't affect this check —
        // deleting the org cascades their memberships too, same as it does the caller's.
        var admins = membershipRepo.findByOrgIdAndStatusAndRoleForUpdate(orgId, MembershipStatus.ACTIVE, Role.ADMIN);
        if (admins.size() != 1 || !admins.get(0).getUserId().equals(userId)) {
            throw new NotSoleAdminException();
        }

        // Synchronous, before any local write — same atomic-core convention as
        // register()/createOrgForExistingUser()'s provision call, just in reverse: if
        // org-service is unreachable or the delete fails, this whole method throws before
        // a single local Membership row is removed. (The reverse ordering failure mode —
        // org-service's row gone but a subsequent local step throwing — is accepted as
        // vanishingly unlikely, same as the equivalent risk already accepted for provision;
        // nothing after this point makes an external call that could itself fail.)
        orgClient.delete(orgId);

        var memberships = membershipRepo.findByOrgId(orgId); // every status, not just ACTIVE
        for (var m : memberships) {
            if (membershipRepo.deleteByUserIdAndOrgIdIfExists(m.getUserId(), orgId) == 1) {
                publishMembershipRemovedAfterCommit(m.getUserId(), orgId);
            }
        }
        refreshTokenRepo.deleteByOrgId(orgId);

        boolean callerAccountDeleted = false;
        for (var m : memberships) {
            String affectedUserId = m.getUserId();
            if (membershipRepo.existsByUserIdAndStatus(affectedUserId, MembershipStatus.ACTIVE)) {
                // Still belongs to at least one other org — only this org's session dies.
                revokeSessionsForOrg(affectedUserId, orgId);
            } else {
                // No ACTIVE membership left anywhere — this account's lifecycle ends with
                // the org it was tied to, same cleanup deleteAccount() does for itself.
                refreshTokenRepo.deleteByUserId(affectedUserId);
                repo.deleteById(affectedUserId);
                revokeAllSessions(affectedUserId);
                if (affectedUserId.equals(userId)) callerAccountDeleted = true;
            }
        }

        publishOrgDeletedAfterCommit(orgId);

        if (callerAccountDeleted) {
            return new DeleteOrganizationResponse(true, false, null);
        }
        var remaining = membershipRepo.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE);
        if (remaining.isEmpty()) {
            return new DeleteOrganizationResponse(false, false, null);
        }
        var target = remaining.stream().min(Comparator.comparing(Membership::getCreatedAt)).orElseThrow();
        var refreshedCaller = repo.findById(userId).orElseThrow(InvalidCredentialsException::new);
        String token = jwtUtil.issue(userId, target.getOrgId(), target.getRole().name(), Constants.USER_TOKEN_TTL_SECONDS,
                List.of(), registerSession(userId, target.getOrgId()));
        var session = mapper.toAuthResponse(refreshedCaller, target.getOrgId(), target.getRole().name(), token,
                issueRefreshToken(userId, target.getOrgId()));
        return new DeleteOrganizationResponse(false, true, session);
    }

    /** Same afterCommit-deferral rationale as publishMembershipRemovedAfterCommit — Kafka
     *  isn't a participant in the JDBC transaction, so publishing only after it commits
     *  avoids a phantom OrgDeleted event for a deletion that later rolled back. */
    private void publishOrgDeletedAfterCommit(String orgId) {
        var payload = new OrgDeletedPayload(orgId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publisher.publishOrgDeleted(payload);
                }
            });
        } else {
            publisher.publishOrgDeleted(payload);
        }
    }

    @Override
    public List<ClientResponse> listClients(String orgId) {
        return serviceClientRepo.findByOrgId(orgId).stream().map(this::toClientResponse).toList();
    }

    @Override
    public ClientResponse getClient(String orgId, String clientId) {
        var client = serviceClientRepo.findById(clientId).filter(c -> c.getOrgId().equals(orgId))
                .orElseThrow(() -> new ClientNotFoundException(clientId));
        return toClientResponse(client);
    }

    @Override
    public List<ClientResponse> recentClientUsage(String orgId, int limit) {
        return serviceClientRepo.findTop5ByOrgIdAndLastUsedAtIsNotNullOrderByLastUsedAtDesc(orgId).stream()
                .limit(limit)
                .map(this::toClientResponse)
                .toList();
    }

    @Override
    public ClientSecretResponse createClient(String orgId, CreateClientRequest request) {
        if (serviceClientRepo.existsById(request.clientId())) {
            throw new ClientAlreadyExistsException(request.clientId());
        }
        Provider provider = parseProvider(request.provider());
        if (!ProviderMetadata.of(provider).supportsApiKey()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, provider + " does not support API keys");
        }
        List<String> scopes = request.scopes() == null || request.scopes().isEmpty()
                ? ProviderMetadata.of(provider).defaultScopes() : request.scopes();
        for (String scope : scopes) {
            if (!Scope.KNOWN.contains(scope)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown scope: " + scope);
            }
        }
        String plainSecret = "cs_" + TokenHasher.newOpaqueToken();
        var client = new ServiceClient(request.clientId(), passwordEncoder.encode(plainSecret), orgId,
                request.name(), provider, String.join(",", scopes), Instant.now(), request.expiresAt(),
                null, null, 0L);
        serviceClientRepo.save(client);
        return new ClientSecretResponse(request.clientId(), plainSecret, client.getCreatedAt());
    }

    @Override
    public ClientSecretResponse rotateClient(String orgId, String clientId) {
        var client = serviceClientRepo.findById(clientId).filter(c -> c.getOrgId().equals(orgId))
                .orElseThrow(() -> new ClientNotFoundException(clientId));
        String plainSecret = "cs_" + TokenHasher.newOpaqueToken();
        client.setClientSecretHash(passwordEncoder.encode(plainSecret));
        serviceClientRepo.save(client);
        return new ClientSecretResponse(clientId, plainSecret, Instant.now());
    }

    /** Soft-revoke, not a hard delete — a revoked key keeps listing (as REVOKED) with
     *  its usage history intact instead of disappearing outright. */
    @Override
    public void deleteClient(String orgId, String clientId) {
        var client = serviceClientRepo.findById(clientId).filter(c -> c.getOrgId().equals(orgId))
                .orElseThrow(() -> new ClientNotFoundException(clientId));
        client.setRevokedAt(Instant.now());
        serviceClientRepo.save(client);
    }

    private Provider parseProvider(String raw) {
        if (raw == null || raw.isBlank()) return Provider.GENERIC;
        try {
            return Provider.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown provider: " + raw);
        }
    }

    private ClientResponse toClientResponse(ServiceClient c) {
        long requestsToday = requestsToday(c.getClientId());
        Instant now = Instant.now();
        String status;
        if (c.getRevokedAt() != null) {
            status = "REVOKED";
        } else if (c.getExpiresAt() != null && c.getExpiresAt().isBefore(now)) {
            status = "EXPIRED";
        } else if (c.getExpiresAt() != null && c.getExpiresAt().isBefore(now.plusSeconds(7L * 24 * 3600))) {
            status = "EXPIRING_SOON";
        } else {
            status = "ACTIVE";
        }
        List<String> scopes = c.getScopes() == null || c.getScopes().isBlank()
                ? List.of() : Arrays.asList(c.getScopes().split(","));
        return new ClientResponse(c.getClientId(), c.getName(), c.getProvider().name(), c.getOrgId(), scopes,
                c.getCreatedAt(), c.getExpiresAt(), c.getLastUsedAt(), c.getRevokedAt(),
                requestsToday, c.getRequestCountTotal(), status);
    }

    /** Mirrors the key {@code GatewayJwtFilter} increments on every service-token
     *  request — read-only here, this service never writes to it. */
    private long requestsToday(String clientId) {
        String value = redis.opsForValue().get("usage:" + clientId + ":" + LocalDate.now());
        return value == null ? 0L : Long.parseLong(value);
    }

    /** {@code orgId} is a named parameter here (unlike login, where the org isn't known
     *  until after the DB lookup) so AuditAspect can attribute this to the right tenant —
     *  see the class-level note on why login isn't annotated the same way.
     *
     *  Verifies the caller against a real stored {@link ServiceClient} record (BCrypt
     *  secret hash) instead of the previous "does the secret start with cs_" check, and
     *  confirms the caller-supplied {@code orgId} actually matches that client's own org
     *  rather than trusting it outright — a caller could previously request a token for
     *  any org just by naming it in the query string. */
    @Override
    @Audited(action = "SERVICE_TOKEN_ISSUED", entityType = "ServiceToken")
    public TokenResponse clientCredentials(String clientId, String clientSecret, String orgId) {
        var client = serviceClientRepo.findById(clientId).orElseThrow(InvalidClientException::new);
        if (!passwordEncoder.matches(clientSecret, client.getClientSecretHash())) {
            throw new InvalidClientException();
        }
        if (!client.getOrgId().equals(orgId)) {
            throw new InvalidClientException();
        }
        if (client.getRevokedAt() != null) {
            throw new InvalidClientException();
        }
        if (client.getExpiresAt() != null && client.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidClientException();
        }
        List<String> scopes = client.getScopes() == null || client.getScopes().isBlank()
                ? List.of() : Arrays.asList(client.getScopes().split(","));
        client.setLastUsedAt(Instant.now());
        client.setRequestCountTotal(client.getRequestCountTotal() + 1);
        serviceClientRepo.save(client);
        String token = jwtUtil.issue(clientId, client.getOrgId(), "service", Constants.SERVICE_TOKEN_TTL_SECONDS, scopes);
        return new TokenResponse(token, "Bearer");
    }

    @Override
    public List<InvitationResponse> listInvitations(String orgId) {
        return invitationRepo.findByOrgIdAndAcceptedFalseAndRevokedFalseOrderByCreatedAtDesc(orgId).stream()
                .map(mapper::toInvitationResponse).toList();
    }

    @Override
    @Audited(action = "INVITATION_CREATED", entityType = "Invitation")
    public InvitationResponse createInvitation(String orgId, String invitedByUserId, String email, String role) {
        var existingAccount = repo.findByEmail(email);
        if (existingAccount.isPresent()
                && membershipRepo.existsByUserIdAndOrgIdAndStatus(existingAccount.get().getId(), orgId, MembershipStatus.ACTIVE)) {
            throw new AlreadyOrgMemberException();
        }
        if (invitationRepo.existsByOrgIdAndEmailIgnoreCaseAndAcceptedFalseAndRevokedFalse(orgId, email)) {
            throw new InvitationAlreadyPendingException(email);
        }
        String plain = TokenHasher.newOpaqueToken();
        Role parsedRole = Role.parse(role);
        var invitation = new Invitation(UUID.randomUUID().toString(), orgId, email, parsedRole,
                TokenHasher.sha256Hex(plain), invitedByUserId,
                Instant.now().plusSeconds(Constants.INVITATION_TOKEN_TTL_SECONDS), Instant.now(), false, false);
        invitationRepo.save(invitation);
        invitationMailer.sendInvite(email, parsedRole.name(), plain);
        return mapper.toInvitationResponse(invitation);
    }

    @Override
    @Audited(action = "INVITATION_REVOKED", entityType = "Invitation")
    public void revokeInvitation(String orgId, String invitationId) {
        var invitation = invitationRepo.findById(invitationId).filter(i -> i.getOrgId().equals(orgId))
                .orElseThrow(() -> new InvitationNotFoundException(invitationId));
        invitation.setRevoked(true);
        invitationRepo.save(invitation);
    }

    @Override
    public InvitationPreviewResponse verifyInvitation(String token) {
        var invitation = invitationRepo.findByTokenHash(TokenHasher.sha256Hex(token))
                .orElseThrow(InvalidInvitationException::new);
        if (invitation.isRevoked()) throw new InvalidInvitationException();
        if (invitation.isAccepted()) throw new InvitationAlreadyAcceptedException();
        if (invitation.getExpiresAt().isBefore(Instant.now())) throw new InvitationExpiredException();

        String orgName = resolveOrgName(invitation.getOrgId());
        String invitedByName = repo.findById(invitation.getInvitedByUserId())
                .map(UserAccount::getName).orElse(invitation.getInvitedByUserId());
        boolean hasExistingAccount = repo.findByEmail(invitation.getEmail()).isPresent();
        return new InvitationPreviewResponse(invitation.getEmail(), invitation.getOrgId(), orgName,
                invitation.getRole().name(), invitedByName, invitation.getExpiresAt(), hasExistingAccount);
    }

    /** Swallows Feign failures and falls back to the raw org id — a transient
     *  org-service hiccup shouldn't break invitation preview or the org switcher. */
    private String resolveOrgName(String orgId) {
        try {
            return orgClient.getName(orgId).name();
        } catch (Exception e) {
            return orgId;
        }
    }
}
