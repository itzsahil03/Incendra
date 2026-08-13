package io.incidentops.user.repository;

import io.incidentops.user.entity.User;
import io.incidentops.user.entity.UserProfileId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserRepository extends JpaRepository<User, UserProfileId> {
    List<User> findByOrgId(String orgId);
    List<User> findByOrgIdAndActive(String orgId, boolean active);
}
