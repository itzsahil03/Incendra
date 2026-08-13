ALTER TABLE service_clients
    ADD COLUMN name                 VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN provider              VARCHAR(20) NOT NULL DEFAULT 'GENERIC',
    ADD COLUMN scopes                VARCHAR(500),
    ADD COLUMN expires_at            TIMESTAMP NULL,
    ADD COLUMN revoked_at            TIMESTAMP NULL,
    ADD COLUMN last_used_at          TIMESTAMP NULL,
    ADD COLUMN request_count_total   BIGINT NOT NULL DEFAULT 0;
