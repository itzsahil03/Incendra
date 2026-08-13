package io.incidentops.auth.repository;

import io.incidentops.auth.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Row-locks the matched token for the duration of the caller's transaction — used
     *  (instead of the plain lookup above) by every method that reads-then-revokes a
     *  refresh token within its own transaction: refresh(), switchOrg(),
     *  acceptInvitation(), leaveOrganization(), and createOrgForExistingUser()'s strict
     *  branch. Without this, two near-simultaneous requests presenting the same refresh
     *  token could both read revoked=false before either commits its own revocation,
     *  letting one token rotate into two valid replacements. A second concurrent request
     *  blocks until the first transaction commits, then correctly observes revoked=true. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rt FROM RefreshToken rt WHERE rt.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    /** Bulk cleanup for account deletion — every session (across every org) this account
     *  ever had a refresh token for. Nothing else needs a per-user bulk delete today. */
    void deleteByUserId(String userId);

    /** Bulk cleanup for org deletion — every refresh token pinned to the deleted org,
     *  regardless of whose account it belongs to (some of those accounts survive the
     *  deletion if they have another org; their refresh token for *this* org is dead
     *  either way, since the org itself is gone). */
    void deleteByOrgId(String orgId);
}
