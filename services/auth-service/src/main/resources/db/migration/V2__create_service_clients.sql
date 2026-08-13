CREATE TABLE service_clients (
    client_id           VARCHAR(64) PRIMARY KEY,
    client_secret_hash  VARCHAR(255) NOT NULL,
    org_id               VARCHAR(64) NOT NULL,
    created_at            TIMESTAMP NOT NULL
);
