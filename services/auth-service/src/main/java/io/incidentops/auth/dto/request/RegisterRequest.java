package io.incidentops.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank String name,
        @NotBlank String password,
        /** Legacy/tooling-only: joins-or-bootstraps the named org if present. Not exposed by
         *  the web UI. Ignored when inviteToken is present; the invitation's own org wins
         *  instead. */
        String orgId,
        /** optional — when present, org/role come from the invitation instead of the
         *  usual bootstrap-admin-or-viewer default, and must match this email. */
        String inviteToken,
        /** Required when neither inviteToken nor orgId is present (the web UI's
         *  RegisterPage → WelcomePage path) — the account is only ever created together
         *  with a real, named org in one atomic step; there is no "register now, name an
         *  org later" state. See AuthServiceImpl.register(). */
        String orgName
) {}
