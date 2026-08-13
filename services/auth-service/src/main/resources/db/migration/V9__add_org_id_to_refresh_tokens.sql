-- Every pre-existing refresh token is invalidated outright (not merely marked revoked)
-- rather than backfilled with a guessed org_id: a pre-existing token's org was never
-- recorded, so any inferred value would be a guess, not a fact — a wrong guess would
-- silently hand a session an incorrect org's credentials on its next refresh, exactly the
-- class of bug this whole revision exists to eliminate. Deleting them (rather than keeping
-- revoked rows with a placeholder org_id) also means the ADD COLUMN ... NOT NULL step below
-- has no existing row to violate it: an empty table trivially satisfies a new NOT NULL
-- constraint, no backfill or NULL-precondition check needed.
--
-- This is a one-time, deliberate, accepted cost: every currently-logged-in user must log
-- in again once. Their access token (short-lived) simply expires and fails to refresh —
-- no special-case handling needed, this looks identical to any other expired session.
DELETE FROM refresh_tokens;
ALTER TABLE refresh_tokens ADD COLUMN org_id VARCHAR(64) NOT NULL;
