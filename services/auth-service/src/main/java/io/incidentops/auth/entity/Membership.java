package io.incidentops.auth.entity;

import io.incidentops.common.security.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** The authoritative source of a user's org/role once they hold one — {@link UserAccount}'s
 *  own {@code orgId}/{@code role} are kept only as a transitional, default-for-a-brand-new-
 *  login hint (see UserAccount's class comment) and are never read/written by any of the
 *  session-transition operations that touch this entity. One row per {@code (userId, orgId)}
 *  pair, enforced by the unique constraint in V8's migration. */
@Entity
@Table(name = "memberships")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Membership {
    @Id
    private String id;
    private String userId;
    private String orgId;
    @Enumerated(EnumType.STRING)
    private Role role;
    @Enumerated(EnumType.STRING)
    private MembershipStatus status;
    private Instant createdAt;
}
