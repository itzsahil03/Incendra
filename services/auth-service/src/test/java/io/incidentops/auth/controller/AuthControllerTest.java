package io.incidentops.auth.controller;

import io.incidentops.auth.dto.request.*;
import io.incidentops.auth.dto.response.*;
import io.incidentops.auth.service.AuthService;
import io.incidentops.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Plain unit tests — the controller has no logic of its own beyond delegation plus
 *  RoleGuard checks, so a mocked AuthService and direct construction (same convention
 *  as GatewayJwtFilterTest) is enough; no MockMvc/Spring context needed. */
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    AuthService service;

    AuthController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthController(service);
    }

    @Test
    void registerDelegatesToService() {
        var request = new RegisterRequest("a@example.com", "A", "pw", null, null, "Org");
        var response = new AuthResponse("t", "rt", null);
        when(service.register(request)).thenReturn(response);

        assertThat(controller.register(request)).isSameAs(response);
    }

    @Test
    void loginDelegatesToService() {
        var request = new LoginRequest("a@example.com", "pw");
        var response = new AuthResponse("t", "rt", null);
        when(service.login(request)).thenReturn(response);

        assertThat(controller.login(request)).isSameAs(response);
    }

    @Test
    void tokenDelegatesToClientCredentials() {
        var response = new TokenResponse("t", "Bearer");
        when(service.clientCredentials("c-1", "secret", "org-a")).thenReturn(response);

        assertThat(controller.token("c-1", "secret", "org-a")).isSameAs(response);
    }

    @Test
    void refreshUnwrapsTheRefreshTokenFromTheRequestBody() {
        var response = new AuthResponse("t", "rt", null);
        when(service.refresh("plain-token")).thenReturn(response);

        assertThat(controller.refresh(new RefreshRequest("plain-token"))).isSameAs(response);
    }

    @Test
    void logoutDelegatesToService() {
        controller.logout(new LogoutRequest("plain-token"));

        verify(service).logout("plain-token");
    }

    @Test
    void forgotPasswordDelegatesToService() {
        controller.forgotPassword(new ForgotPasswordRequest("a@example.com"));

        verify(service).forgotPassword("a@example.com");
    }

    @Test
    void resetPasswordDelegatesToService() {
        controller.resetPassword(new ResetPasswordRequest("token", "newpass"));

        verify(service).resetPassword("token", "newpass");
    }

    @Test
    void changePasswordScopesToTheCallersOwnUserId() {
        controller.changePassword("u-1", new ChangePasswordRequest("old", "new"));

        verify(service).changePassword("u-1", "old", "new");
    }

    @Test
    void deleteAccountScopesToTheCallersOwnUserId() {
        controller.deleteAccount("u-1", new DeleteAccountRequest("pw"));

        verify(service).deleteAccount("u-1", "pw");
    }

    @Test
    void listUsersRequiresAdminRole() {
        assertThatThrownBy(() -> controller.listUsers("org-a", "VIEWER")).isInstanceOf(ApiException.class);
    }

    @Test
    void listUsersDelegatesWhenCallerIsAdmin() {
        when(service.listUsers("org-a")).thenReturn(List.of());

        assertThat(controller.listUsers("org-a", "ADMIN")).isEmpty();
    }

    @Test
    void updateRoleRequiresAdminRole() {
        var request = new UpdateRoleRequest("ADMIN");
        assertThatThrownBy(() -> controller.updateRole("u-2", "org-a", "RESPONDER", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updateRoleDelegatesWhenCallerIsAdmin() {
        var request = new UpdateRoleRequest("ADMIN");
        var response = new UserAccountResponse("u-2", "b@example.com", "B", "ADMIN", null);
        when(service.updateRole("org-a", "u-2", "ADMIN")).thenReturn(response);

        assertThat(controller.updateRole("u-2", "org-a", "ADMIN", request)).isSameAs(response);
    }

    @Test
    void removeMembershipRequiresAdminRole() {
        assertThatThrownBy(() -> controller.removeMembership("u-2", "org-a", "VIEWER"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void removeMembershipDelegatesWhenCallerIsAdmin() {
        controller.removeMembership("u-2", "org-a", "ADMIN");

        verify(service).removeMembership("org-a", "u-2");
    }

    @Test
    void leaveOrganizationDelegatesWithNoRoleCheck() {
        var request = new LeaveOrganizationRequest("plain-token");
        var response = new LeaveOrganizationResponse(false, true, null);
        when(service.leaveOrganization("u-1", "org-a", "org-a", "plain-token")).thenReturn(response);

        assertThat(controller.leaveOrganization("org-a", "u-1", "org-a", request)).isSameAs(response);
    }

    @Test
    void createOrgDelegatesToService() {
        var request = new CreateOrgMembershipRequest("plain-token", "New Org");
        var response = new AuthResponse("t", "rt", null);
        when(service.createOrgForExistingUser("u-1", "org-a", "plain-token", "New Org")).thenReturn(response);

        assertThat(controller.createOrg("u-1", "org-a", request)).isSameAs(response);
    }

    @Test
    void switchOrgDelegatesToService() {
        var request = new SwitchOrgRequest("org-b", "plain-token");
        var response = new AuthResponse("t", "rt", null);
        when(service.switchOrg("u-1", "org-a", "org-b", "plain-token")).thenReturn(response);

        assertThat(controller.switchOrg("u-1", "org-a", request)).isSameAs(response);
    }

    @Test
    void myOrgsDelegatesToService() {
        when(service.myOrgs("u-1")).thenReturn(List.of(new MembershipResponse("org-a", "Org A", "ADMIN")));

        assertThat(controller.myOrgs("u-1")).hasSize(1);
    }

    @Test
    void orgSummaryDelegatesToService() {
        var response = new OrgSummaryResponse("org-a", 3, 1);
        when(service.orgSummary("org-a")).thenReturn(response);

        assertThat(controller.orgSummary("org-a")).isSameAs(response);
    }

    @Test
    void deleteOrganizationDelegatesToService() {
        var request = new DeleteOrgRequest("pw");
        var response = new DeleteOrganizationResponse(true, false, null);
        when(service.deleteOrganization("u-1", "org-a", "pw")).thenReturn(response);

        assertThat(controller.deleteOrganization("u-1", "org-a", request)).isSameAs(response);
    }

    @Test
    void listClientsRequiresAdminRole() {
        assertThatThrownBy(() -> controller.listClients("org-a", "VIEWER")).isInstanceOf(ApiException.class);
    }

    @Test
    void listClientsDelegatesWhenCallerIsAdmin() {
        when(service.listClients("org-a")).thenReturn(List.of());

        assertThat(controller.listClients("org-a", "ADMIN")).isEmpty();
    }

    @Test
    void recentClientUsageRequiresAdminRoleAndDefaultsLimitTo5() {
        assertThatThrownBy(() -> controller.recentClientUsage("org-a", "VIEWER", 5)).isInstanceOf(ApiException.class);

        when(service.recentClientUsage("org-a", 5)).thenReturn(List.of());
        assertThat(controller.recentClientUsage("org-a", "ADMIN", 5)).isEmpty();
    }

    @Test
    void getClientRequiresAdminRole() {
        assertThatThrownBy(() -> controller.getClient("c-1", "org-a", "VIEWER")).isInstanceOf(ApiException.class);
    }

    @Test
    void createClientRequiresAdminRole() {
        var request = new CreateClientRequest("c-1", "Client", "GENERIC", List.of(), null);
        assertThatThrownBy(() -> controller.createClient("org-a", "VIEWER", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void createClientDelegatesWhenCallerIsAdmin() {
        var request = new CreateClientRequest("c-1", "Client", "GENERIC", List.of(), null);
        var response = new ClientSecretResponse("c-1", "cs_secret", null);
        when(service.createClient("org-a", request)).thenReturn(response);

        assertThat(controller.createClient("org-a", "ADMIN", request)).isSameAs(response);
    }

    @Test
    void rotateClientRequiresAdminRole() {
        assertThatThrownBy(() -> controller.rotateClient("c-1", "org-a", "RESPONDER")).isInstanceOf(ApiException.class);
    }

    @Test
    void deleteClientRequiresAdminRole() {
        assertThatThrownBy(() -> controller.deleteClient("c-1", "org-a", "RESPONDER")).isInstanceOf(ApiException.class);
    }

    @Test
    void deleteClientDelegatesWhenCallerIsAdmin() {
        controller.deleteClient("c-1", "org-a", "ADMIN");

        verify(service).deleteClient("org-a", "c-1");
    }

    @Test
    void listInvitationsRequiresAdminRole() {
        assertThatThrownBy(() -> controller.listInvitations("org-a", "VIEWER")).isInstanceOf(ApiException.class);
    }

    @Test
    void createInvitationRequiresAdminRole() {
        var request = new CreateInvitationRequest("a@example.com", "VIEWER");
        assertThatThrownBy(() -> controller.createInvitation("org-a", "VIEWER", "u-1", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void createInvitationDelegatesWhenCallerIsAdmin() {
        var request = new CreateInvitationRequest("a@example.com", "VIEWER");
        var response = new InvitationResponse("inv-1", "a@example.com", "VIEWER", "admin-1", null, null);
        when(service.createInvitation("org-a", "u-1", "a@example.com", "VIEWER")).thenReturn(response);

        assertThat(controller.createInvitation("org-a", "ADMIN", "u-1", request)).isSameAs(response);
    }

    @Test
    void revokeInvitationRequiresAdminRole() {
        assertThatThrownBy(() -> controller.revokeInvitation("inv-1", "org-a", "VIEWER")).isInstanceOf(ApiException.class);
    }

    @Test
    void revokeInvitationDelegatesWhenCallerIsAdmin() {
        controller.revokeInvitation("inv-1", "org-a", "ADMIN");

        verify(service).revokeInvitation("org-a", "inv-1");
    }

    @Test
    void verifyInvitationIsPublicAndDelegatesToService() {
        var response = new InvitationPreviewResponse("a@example.com", "org-a", "Org A", "VIEWER", "Admin", null, false);
        when(service.verifyInvitation("token")).thenReturn(response);

        assertThat(controller.verifyInvitation("token")).isSameAs(response);
    }

    @Test
    void acceptInvitationDelegatesToService() {
        var request = new AcceptInvitationRequest("plain-token");
        var response = new AuthResponse("t", "rt", null);
        when(service.acceptInvitation("u-1", "org-a", "token", "plain-token")).thenReturn(response);

        assertThat(controller.acceptInvitation("token", "u-1", "org-a", request)).isSameAs(response);
    }
}
