package io.incidentops.auth.repository;

import io.incidentops.auth.entity.Membership;
import io.incidentops.auth.entity.MembershipStatus;
import io.incidentops.common.security.Role;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MembershipRepository extends JpaRepository<Membership, String> {
    List<Membership> findByUserId(String userId);
    List<Membership> findByUserIdAndStatus(String userId, MembershipStatus status);
    List<Membership> findByOrgId(String orgId);
    List<Membership> findByOrgIdAndStatus(String orgId, MembershipStatus status);
    Optional<Membership> findByUserIdAndOrgId(String userId, String orgId);
    boolean existsByUserIdAndOrgId(String userId, String orgId);
    boolean existsByUserIdAndOrgIdAndStatus(String userId, String orgId, MembershipStatus status);
    boolean existsByOrgId(String orgId);
    boolean existsByUserIdAndStatus(String userId, MembershipStatus status);
    long countByOrgIdAndStatus(String orgId, MembershipStatus status);
    long countByOrgIdAndStatusAndRole(String orgId, MembershipStatus status, Role role);

    /** Row-locks the org's ACTIVE ADMIN membership rows for the duration of the caller's
     *  transaction — the last-admin-protection guard (demotion, removal, leave) reads this
     *  under lock so a second concurrent request blocks until the first commits/rolls back,
     *  rather than both observing "2 admins" and letting the org end up with zero. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Membership m WHERE m.orgId = :orgId AND m.status = :status AND m.role = :role")
    List<Membership> findByOrgIdAndStatusAndRoleForUpdate(@Param("orgId") String orgId,
                                                            @Param("status") MembershipStatus status,
                                                            @Param("role") Role role);

    /** Atomic, self-reporting delete — returns the number of rows actually removed (0 or
     *  1) rather than requiring a separate find-then-delete, so two concurrent removal
     *  attempts for the same (userId, orgId) (e.g. an admin's "remove" racing the member's
     *  own "leave") can tell which one actually performed the removal. See Backend item
     *  9.6 — used by both remove-member and leave-organization to decide whether to
     *  publish UserMembershipRemoved (only the request that observes affectedRows == 1
     *  does; affectedRows == 0 means someone else already did it, treated as an idempotent
     *  success). */
    @Modifying
    @Query("DELETE FROM Membership m WHERE m.userId = :userId AND m.orgId = :orgId")
    int deleteByUserIdAndOrgIdIfExists(@Param("userId") String userId, @Param("orgId") String orgId);
}
