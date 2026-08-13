package io.incidentops.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateUserRequest(
        @NotBlank @Email String email,
        @NotBlank String name,
        String notificationPrefs
) {}
