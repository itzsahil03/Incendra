CREATE TABLE services (
    id          VARCHAR(64) PRIMARY KEY,
    org_id      VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    created_at  TIMESTAMP NOT NULL
);

CREATE INDEX idx_services_org_id ON services (org_id);
