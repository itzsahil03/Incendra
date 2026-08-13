package io.incidentops.auth.controller;

import io.incidentops.auth.dto.request.AcceptInvitationRequest;
import io.incidentops.auth.dto.request.ChangePasswordRequest;
import io.incidentops.auth.dto.request.CreateOrgMembershipRequest;
import io.incidentops.auth.dto.request.DeleteAccountRequest;
import io.incidentops.auth.dto.request.DeleteOrgRequest;
import io.incidentops.auth.dto.request.ForgotPasswordRequest;
import io.incidentops.auth.dto.request.LeaveOrganizationRequest;
import io.incidentops.auth.dto.request.LoginRequest;
import io.incidentops.auth.dto.request.LogoutRequest;
import io.incidentops.auth.dto.request.RefreshRequest;
import io.incidentops.auth.dto.request.RegisterRequest;
import io.incidentops.auth.dto.request.CreateClientRequest;
import io.incidentops.auth.dto.request.CreateInvitationRequest;
import io.incidentops.auth.dto.request.ResetPasswordRequest;
import io.incidentops.auth.dto.request.SwitchOrgRequest;
import io.incidentops.auth.dto.request.UpdateRoleRequest;
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
import io.incidentops.auth.service.AuthService;
import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return service.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @PostMapping("/token")
    public TokenResponse token(@RequestParam String clientId,
                                @RequestParam String clientSecret,
                                @RequestParam String orgId) {
        return service.clientCredentials(clientId, clientSecret, orgId);
    }

    /** Public like register/login/token — a caller refreshing is often doing so
     *  *because* their access token already expired, so this can't require a valid
     *  bearer token itself. The refresh token in the body is the credential. */
    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return service.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody LogoutRequest request) {
        service.logout(request.refreshToken());
    }

    /** Always 200 regardless of whether the email is registered — never reveals which
     *  emails have accounts. Public, same as register/login. */
    @PostMapping("/forgot-password")
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        service.forgotPassword(request.email());
    }

    @PostMapping("/reset-password")
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        service.resetPassword(request.token(), request.newPassword());
    }

    /** Self-service only — X-User-Id is the gateway-trusted caller identity from their
     *  own validated JWT, not a path/body parameter, so this can only ever change the
     *  caller's own password. */
    @PostMapping("/change-password")
    public void changePassword(@RequestHeader("X-User-Id") String userId,
                                @Valid @RequestBody ChangePasswordRequest request) {
        service.changePassword(userId, request.currentPassword(), request.newPassword());
    }

    /** Self-service, same trust model as change-password — X-User-Id can only ever act on
     *  the caller's own account. Permanently deletes it: every org's Membership (fails
     *  fast, before deleting anything, if it would leave any org without an admin), every
     *  refresh token, and the UserAccount row itself. */
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@RequestHeader("X-User-Id") String userId,
                               @Valid @RequestBody DeleteAccountRequest request) {
        service.deleteAccount(userId, request.password());
    }

    /** Directory listing for the caller's own org — gated the same way org-service gates
     *  its own admin-only mutations, via the shared RoleGuard. */
    @GetMapping("/users")
    public List<UserAccountResponse> listUsers(@RequestHeader("X-Org-Id") String orgId,
                                                @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return service.listUsers(orgId);
    }

    @PutMapping("/users/{id}/role")
    public UserAccountResponse updateRole(@PathVariable String id,
                                           @RequestHeader("X-Org-Id") String orgId,
                                           @RequestHeader("X-Role") String role,
                                           @Valid @RequestBody UpdateRoleRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return service.updateRole(orgId, id, request.role());
    }

    /** Admin-initiated removal from the caller's own org — removes only the target's
     *  Membership row, not their UserAccount or any other org's membership. */
    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMembership(@PathVariable String id,
                                  @RequestHeader("X-Org-Id") String orgId,
                                  @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        service.removeMembership(orgId, id);
    }

    /** Self-service — no RoleGuard, this only ever acts on the caller's own membership.
     *  Only meaningful for the caller's currently-active org; see AuthServiceImpl. */
    @DeleteMapping("/memberships/{orgId}")
    public LeaveOrganizationResponse leaveOrganization(@PathVariable String orgId,
                                                        @RequestHeader("X-User-Id") String userId,
                                                        @RequestHeader("X-Org-Id") String currentOrgId,
                                                        @Valid @RequestBody LeaveOrganizationRequest request) {
        return service.leaveOrganization(userId, currentOrgId, orgId, request.refreshToken());
    }

    /** Create an additional organization for an existing user, or bootstrap the first
     *  one for a caller with zero ACTIVE memberships — see AuthServiceImpl for the
     *  two-branch security model (refreshToken required only in the former case).
     *  orgName is always required — provisioned atomically, named from the start. */
    @PostMapping("/orgs")
    public AuthResponse createOrg(@RequestHeader("X-User-Id") String userId,
                                   @RequestHeader(value = "X-Org-Id", required = false) String currentOrgId,
                                   @Valid @RequestBody CreateOrgMembershipRequest request) {
        return service.createOrgForExistingUser(userId, currentOrgId, request.refreshToken(), request.orgName());
    }

    @PostMapping("/switch-org")
    public AuthResponse switchOrg(@RequestHeader("X-User-Id") String userId,
                                   @RequestHeader("X-Org-Id") String currentOrgId,
                                   @Valid @RequestBody SwitchOrgRequest request) {
        return service.switchOrg(userId, currentOrgId, request.orgId(), request.refreshToken());
    }

    @GetMapping("/my-orgs")
    public List<MembershipResponse> myOrgs(@RequestHeader("X-User-Id") String userId) {
        return service.myOrgs(userId);
    }

    @GetMapping("/org-summary")
    public OrgSummaryResponse orgSummary(@RequestHeader("X-Org-Id") String orgId) {
        return service.orgSummary(orgId);
    }

    /** Only the org's sole ACTIVE admin may call this — see AuthServiceImpl for the
     *  sole-admin check and the full cascade (every member's Membership removed, any
     *  member left with zero ACTIVE memberships anywhere has their account deleted). */
    @DeleteMapping("/org")
    public DeleteOrganizationResponse deleteOrganization(@RequestHeader("X-User-Id") String userId,
                                                           @RequestHeader("X-Org-Id") String orgId,
                                                           @Valid @RequestBody DeleteOrgRequest request) {
        return service.deleteOrganization(userId, orgId, request.password());
    }

    @GetMapping("/clients")
    public List<ClientResponse> listClients(@RequestHeader("X-Org-Id") String orgId,
                                             @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return service.listClients(orgId);
    }

    @GetMapping("/clients/recent-usage")
    public List<ClientResponse> recentClientUsage(@RequestHeader("X-Org-Id") String orgId,
                                                    @RequestHeader("X-Role") String role,
                                                    @RequestParam(defaultValue = "5") int limit) {
        RoleGuard.require(role, Role.ADMIN);
        return service.recentClientUsage(orgId, limit);
    }

    @GetMapping("/clients/{clientId}")
    public ClientResponse getClient(@PathVariable String clientId,
                                     @RequestHeader("X-Org-Id") String orgId,
                                     @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return service.getClient(orgId, clientId);
    }

    /** Returns the plaintext secret exactly once — it's never retrievable again after
     *  this response, same convention as a rotated refresh token. */
    @PostMapping("/clients")
    public ClientSecretResponse createClient(@RequestHeader("X-Org-Id") String orgId,
                                              @RequestHeader("X-Role") String role,
                                              @Valid @RequestBody CreateClientRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return service.createClient(orgId, request);
    }

    @PostMapping("/clients/{clientId}/rotate")
    public ClientSecretResponse rotateClient(@PathVariable String clientId,
                                              @RequestHeader("X-Org-Id") String orgId,
                                              @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return service.rotateClient(orgId, clientId);
    }

    @DeleteMapping("/clients/{clientId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteClient(@PathVariable String clientId,
                              @RequestHeader("X-Org-Id") String orgId,
                              @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        service.deleteClient(orgId, clientId);
    }

    @GetMapping("/invitations")
    public List<InvitationResponse> listInvitations(@RequestHeader("X-Org-Id") String orgId,
                                                      @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return service.listInvitations(orgId);
    }

    @PostMapping("/invitations")
    public InvitationResponse createInvitation(@RequestHeader("X-Org-Id") String orgId,
                                                @RequestHeader("X-Role") String role,
                                                @RequestHeader("X-User-Id") String userId,
                                                @Valid @RequestBody CreateInvitationRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return service.createInvitation(orgId, userId, request.email(), request.role());
    }

    @DeleteMapping("/invitations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeInvitation(@PathVariable String id,
                                  @RequestHeader("X-Org-Id") String orgId,
                                  @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        service.revokeInvitation(orgId, id);
    }

    /** Public, like register/login — a prospective invitee has no token of their own yet.
     *  Lets the registration page pre-fill/lock the email and show which org/role an
     *  invite link resolves to before anything is submitted. */
    @GetMapping("/invitations/verify")
    public InvitationPreviewResponse verifyInvitation(@RequestParam String token) {
        return service.verifyInvitation(token);
    }

    /** Authenticated accept — for an existing logged-in user opening someone else's
     *  invite link. Rotates the caller's session to the newly-joined org, same as
     *  switch-org, and requires the same current-refresh-token precondition. */
    @PostMapping("/invitations/{token}/accept")
    public AuthResponse acceptInvitation(@PathVariable String token,
                                          @RequestHeader("X-User-Id") String userId,
                                          @RequestHeader("X-Org-Id") String currentOrgId,
                                          @Valid @RequestBody AcceptInvitationRequest request) {
        return service.acceptInvitation(userId, currentOrgId, token, request.refreshToken());
    }
}
