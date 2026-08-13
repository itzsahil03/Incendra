-- Backs the "deactivated user" display convention (like Jira's "name (deactivated)"):
-- a directory row for someone removed from an org is no longer a real member, but
-- historical incidents/alerts/audit entries in this org still reference their userId
-- and need a name to show. Soft-deleting (active=false) instead of hard-deleting the
-- row on membership removal keeps that name resolvable indefinitely.
ALTER TABLE user_profiles ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
