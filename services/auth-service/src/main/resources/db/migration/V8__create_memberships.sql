CREATE TABLE memberships (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL,
    org_id      VARCHAR(64) NOT NULL,
    role        VARCHAR(32) NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMP NOT NULL,
    CONSTRAINT uq_memberships_user_org UNIQUE (user_id, org_id)
);
CREATE INDEX idx_memberships_org_id  ON memberships (org_id);
CREATE INDEX idx_memberships_user_id ON memberships (user_id);
-- The hot query patterns are findByOrgIdAndStatus (refresh/switch/listUsers/org-summary)
-- and findByUserIdAndStatus (my-orgs) — status-inclusive composite indexes serve those
-- directly; findByUserIdAndOrgId is already covered by the unique constraint's own index.
CREATE INDEX idx_memberships_org_id_status  ON memberships (org_id, status);
CREATE INDEX idx_memberships_user_id_status ON memberships (user_id, status);

-- WHERE org_id IS NOT NULL is required, not optional: users.org_id was populated from an
-- optional free-text registration field (removed from RegisterPage.tsx in this same
-- change), so an existing account with no org_id set is a real possibility. Inserting NULL
-- into memberships.org_id NOT NULL would fail the whole migration. Accounts with no org_id
-- simply get no backfilled membership — correct, not a gap: they genuinely have zero
-- memberships today, and will land in the "zero organizations" state on next login.
INSERT INTO memberships (id, user_id, org_id, role, status, created_at)
SELECT 'mig_' || id, id, org_id, role, 'ACTIVE', created_at FROM users
WHERE org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;
