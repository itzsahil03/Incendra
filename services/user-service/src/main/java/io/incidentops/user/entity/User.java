package io.incidentops.user.entity;

import io.incidentops.common.security.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "user_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@IdClass(UserProfileId.class)
public class User {
    @Id
    private String id;
    private String email;
    private String name;
    /** Part of the composite PK (id, orgId) — see {@link UserProfileId}. One directory
     *  row per (person, org) pair now, so the same person can appear correctly across
     *  multiple orgs' member lists with a different role in each. */
    @Id
    private String orgId;
    /** Denormalized from auth-service's UserRegistered/UserRoleChanged events — kept in
     *  sync via UserEventConsumer rather than looked up live, so the directory listing
     *  doesn't need a second service call per row. Profiles created directly through
     *  this service's own POST /api/users (not linked to any auth-service account)
     *  default to VIEWER. */
    @Enumerated(EnumType.STRING)
    private Role role;
    /** JSON string, e.g. {"email":true,"slack":true,"sms":false} */
    private String notificationPrefs;
    private Instant createdAt;
    /** False once this person's membership in this org is removed (leave, admin
     *  removal, or org deletion) — the row itself is kept, not hard-deleted, purely so
     *  {@code userId} still resolves to a name for historical incidents/alerts/audit
     *  entries in this org. {@link io.incidentops.user.controller.UserController#list}
     *  excludes inactive rows by default (so pickers/current-member listings don't
     *  offer a departed person), but callers resolving names for history pass
     *  {@code includeInactive=true} and show "{name} (Deactivated)" for these. */
    private boolean active;
}
