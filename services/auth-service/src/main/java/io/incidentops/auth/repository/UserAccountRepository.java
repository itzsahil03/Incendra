package io.incidentops.auth.repository;

import io.incidentops.auth.entity.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, String> {
    Optional<UserAccount> findByEmail(String email);
    List<UserAccount> findByOrgId(String orgId);
    boolean existsByOrgId(String orgId);
}
