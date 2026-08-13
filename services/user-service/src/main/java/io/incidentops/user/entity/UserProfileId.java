package io.incidentops.user.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite key for {@link User} — a person now gets one directory row per org they
 *  belong to, so {@code id} alone (the auth-service account id) is no longer unique. Not
 *  a surrogate PK, since {@code id} is still externally exposed as the {@code GET
 *  /api/users/{id}} path variable and must stay stable. */
public class UserProfileId implements Serializable {
    private String id;
    private String orgId;

    public UserProfileId() {}

    public UserProfileId(String id, String orgId) {
        this.id = id;
        this.orgId = orgId;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserProfileId that)) return false;
        return Objects.equals(id, that.id) && Objects.equals(orgId, that.orgId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, orgId);
    }
}
