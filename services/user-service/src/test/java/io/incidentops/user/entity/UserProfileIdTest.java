package io.incidentops.user.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Composite-key equals/hashCode contract — Spring Data JPA's @IdClass mechanism relies
 *  on both being correct for repo.findById/existsById to key on (id, orgId) rather than
 *  id alone (see UserServiceImplTest's cross-org tests for the behavioral consequence). */
class UserProfileIdTest {

    @Test
    void equalsIsTrueForSameIdAndOrgId() {
        var a = new UserProfileId("u-1", "org-1");
        var b = new UserProfileId("u-1", "org-1");

        assertThat(a).isEqualTo(b);
        assertThat(a.hashCode()).isEqualTo(b.hashCode());
    }

    @Test
    void equalsIsFalseForDifferentOrgIdSameId() {
        var a = new UserProfileId("u-1", "org-1");
        var b = new UserProfileId("u-1", "org-2");

        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void equalsIsFalseForDifferentIdSameOrgId() {
        var a = new UserProfileId("u-1", "org-1");
        var b = new UserProfileId("u-2", "org-1");

        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void equalsIsTrueForSameInstance() {
        var a = new UserProfileId("u-1", "org-1");

        assertThat(a).isEqualTo(a);
    }

    @Test
    void equalsIsFalseForNullAndForDifferentType() {
        var a = new UserProfileId("u-1", "org-1");

        assertThat(a).isNotEqualTo(null);
        assertThat(a).isNotEqualTo("u-1");
    }

    @Test
    void noArgsConstructorAndSettersWork() {
        var id = new UserProfileId();
        id.setId("u-1");
        id.setOrgId("org-1");

        assertThat(id.getId()).isEqualTo("u-1");
        assertThat(id.getOrgId()).isEqualTo("org-1");
    }
}
