CREATE TABLE incidents (
    id            VARCHAR(64) PRIMARY KEY,
    org_id        VARCHAR(64) NOT NULL,
    title         VARCHAR(500) NOT NULL,
    description   VARCHAR(2000),
    severity      VARCHAR(32),
    status        VARCHAR(32),
    assignee_id   VARCHAR(64),
    assignee_name VARCHAR(255),
    alert_id      VARCHAR(64),
    source        VARCHAR(64),
    created_at    TIMESTAMP NOT NULL,
    resolved_at   TIMESTAMP
);

CREATE INDEX idx_incidents_org_id ON incidents (org_id);
