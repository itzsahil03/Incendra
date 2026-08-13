package io.incidentops.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Backs DELETE /api/auth/org. Requires the caller's current password as a re-auth step —
 *  same safety bar as DeleteAccountRequest — since deleting an organization is at least as
 *  destructive as deleting one's own account, and here it also affects every other member. */
public record DeleteOrgRequest(
        @NotBlank String password
) {}
