package io.incidentops.auth.service;

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
import io.incidentops.auth.dto.request.CreateClientRequest;
import io.incidentops.auth.dto.response.UserAccountResponse;

import java.util.List;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    TokenResponse clientCredentials(String clientId, String clientSecret, String orgId);
    List<UserAccountResponse> listUsers(String orgId);
    UserAccountResponse updateRole(String orgId, String userId, String newRole);
    AuthResponse refresh(String refreshToken);
    void logout(String refreshToken);
    void forgotPassword(String email);
    void resetPassword(String token, String newPassword);
    void changePassword(String userId, String currentPassword, String newPassword);

    /** Permanently deletes the caller's own account: every org's Membership (subject to
     *  the same last-admin protection as leaving/removal — fails fast if it would leave
     *  any org without an admin), every refresh token, and the UserAccount row itself.
     *  Requires the current password as a re-auth step, same as changePassword. */
    void deleteAccount(String userId, String password);
    List<ClientResponse> listClients(String orgId);
    ClientResponse getClient(String orgId, String clientId);
    List<ClientResponse> recentClientUsage(String orgId, int limit);
    ClientSecretResponse createClient(String orgId, CreateClientRequest request);
    ClientSecretResponse rotateClient(String orgId, String clientId);
    void deleteClient(String orgId, String clientId);
    List<InvitationResponse> listInvitations(String orgId);
    InvitationResponse createInvitation(String orgId, String invitedByUserId, String email, String role);
    void revokeInvitation(String orgId, String invitationId);
    InvitationPreviewResponse verifyInvitation(String token);

    /** POST /api/auth/orgs — create an additional organization for an existing user
     *  (switcher "+ Create organization") or bootstrap the first one for a caller with
     *  zero ACTIVE memberships. See AuthServiceImpl for the two-branch security model.
     *  orgName is required — the org is provisioned atomically, named from the start. */
    AuthResponse createOrgForExistingUser(String userId, String currentOrgId, String currentRefreshToken, String orgName);
    AuthResponse switchOrg(String userId, String currentOrgId, String orgId, String currentRefreshToken);
    List<MembershipResponse> myOrgs(String userId);
    AuthResponse acceptInvitation(String userId, String currentOrgId, String token, String currentRefreshToken);
    void removeMembership(String orgId, String userId);
    LeaveOrganizationResponse leaveOrganization(String userId, String currentOrgId, String orgId, String currentRefreshToken);
    OrgSummaryResponse orgSummary(String orgId);

    /** DELETE /api/auth/org — deletes the entire organization. Only the org's sole ACTIVE
     *  admin may do this (regardless of whether RESPONDER/VIEWER members remain); requires
     *  the caller's current password, same re-auth bar as deleteAccount. Every member's
     *  Membership for this org is removed; any member left with zero ACTIVE memberships
     *  anywhere (including the caller) has their account deleted outright. See
     *  DeleteOrganizationResponse for the three outcomes the caller's own account can land in. */
    DeleteOrganizationResponse deleteOrganization(String userId, String orgId, String password);
}
