CREATE TABLE user_profiles (
    id                   VARCHAR(64) PRIMARY KEY,
    email                VARCHAR(255) NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    org_id               VARCHAR(64)  NOT NULL,
    notification_prefs   TEXT,
    on_call_schedule     VARCHAR(255),
    created_at           TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_profiles_org_id ON user_profiles (org_id);
