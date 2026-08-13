CREATE TABLE idempotency_keys (
    event_id    VARCHAR(64) PRIMARY KEY,
    consumed_at TIMESTAMP NOT NULL
);
