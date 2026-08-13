CREATE TABLE invitations (
    id                  VARCHAR(64) PRIMARY KEY,
    org_id              VARCHAR(64) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    role                VARCHAR(32) NOT NULL,
    token_hash          VARCHAR(64) NOT NULL UNIQUE,
    invited_by_user_id  VARCHAR(64) NOT NULL,
    expires_at          TIMESTAMP NOT NULL,
    created_at          TIMESTAMP NOT NULL,
    revoked             BOOLEAN NOT NULL DEFAULT FALSE,
    accepted            BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_invitations_org_id ON invitations(org_id);
