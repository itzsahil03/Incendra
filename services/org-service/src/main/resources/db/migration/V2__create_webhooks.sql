CREATE TABLE webhooks (
    id                 VARCHAR(64) PRIMARY KEY,
    org_id             VARCHAR(64) NOT NULL,
    url                VARCHAR(2000) NOT NULL,
    secret             VARCHAR(255) NOT NULL,
    subscribed_topics  VARCHAR(1000),
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP NOT NULL
);

CREATE INDEX idx_webhooks_org_id ON webhooks (org_id);
