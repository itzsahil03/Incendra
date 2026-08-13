CREATE TABLE orgs (
    id             VARCHAR(64) PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP NOT NULL
);
