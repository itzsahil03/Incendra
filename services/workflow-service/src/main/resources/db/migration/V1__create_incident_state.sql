CREATE TABLE incident_state (
    incident_id    VARCHAR(64) PRIMARY KEY,
    org_id         VARCHAR(64) NOT NULL,
    current_state  VARCHAR(32) NOT NULL,
    updated_at     TIMESTAMP NOT NULL
);

CREATE INDEX idx_incident_state_org_id ON incident_state (org_id);
