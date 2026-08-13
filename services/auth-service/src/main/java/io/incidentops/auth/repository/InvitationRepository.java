package io.incidentops.auth.repository;

import io.incidentops.auth.entity.Invitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InvitationRepository extends JpaRepository<Invitation, String> {
    Optional<Invitation> findByTokenHash(String tokenHash);

    List<Invitation> findByOrgIdAndAcceptedFalseAndRevokedFalseOrderByCreatedAtDesc(String orgId);

    boolean existsByOrgIdAndEmailIgnoreCaseAndAcceptedFalseAndRevokedFalse(String orgId, String email);

    /** Atomic accept — shared by register()'s invite branch and the authenticated
     *  acceptInvitation() so both go through the same race-safe path. Returns the number
     *  of rows affected; 0 means someone else already redeemed/revoked/expired it
     *  concurrently, even though an earlier read-check passed. */
    @Modifying
    @Query("UPDATE Invitation i SET i.accepted = true WHERE i.id = :id AND i.accepted = false AND i.revoked = false")
    int markAcceptedIfPending(@Param("id") String id);
}
