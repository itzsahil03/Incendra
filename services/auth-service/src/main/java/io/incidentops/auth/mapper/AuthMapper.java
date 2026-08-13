package io.incidentops.auth.mapper;

import io.incidentops.auth.dto.response.AuthResponse;
import io.incidentops.auth.dto.response.InvitationResponse;
import io.incidentops.auth.dto.response.UserAccountResponse;
import io.incidentops.auth.dto.response.UserSummaryResponse;
import io.incidentops.auth.entity.Invitation;
import io.incidentops.auth.entity.UserAccount;
import org.springframework.stereotype.Component;

@Component
public class AuthMapper {
    /** The session-authoritative form — {@code orgId}/{@code role} come from the
     *  Membership the just-issued tokens are actually scoped to, never from
     *  {@code user.getOrgId()}/{@code user.getRole()} (those are the transitional,
     *  default-for-a-brand-new-login hint only — see UserAccount's class comment). Every
     *  session-transition operation (register, login, refresh, switchOrg,
     *  acceptInvitation, createOrgForExistingUser, leaveOrganization) uses this form. */
    public AuthResponse toAuthResponse(UserAccount user, String orgId, String role, String token, String refreshToken) {
        return new AuthResponse(token, refreshToken,
                new UserSummaryResponse(user.getId(), user.getEmail(), user.getName(), orgId, role));
    }

    /** {@code role} comes from the caller's Membership row for the org being listed, not
     *  {@code user.getRole()} — see listUsers()/updateRole(), which now build these from
     *  Membership so a shared member's role is correct per-org. */
    public UserAccountResponse toUserAccountResponse(UserAccount user, String role) {
        return new UserAccountResponse(user.getId(), user.getEmail(), user.getName(), role, user.getCreatedAt());
    }

    public InvitationResponse toInvitationResponse(Invitation invitation) {
        return new InvitationResponse(invitation.getId(), invitation.getEmail(), invitation.getRole().name(),
                invitation.getInvitedByUserId(), invitation.getCreatedAt(), invitation.getExpiresAt());
    }
}
