ALTER TABLE webhooks
    ADD COLUMN provider                    VARCHAR(20) NOT NULL DEFAULT 'GENERIC',
    ADD COLUMN previous_secret             VARCHAR(255) NULL,
    ADD COLUMN previous_secret_expires_at  TIMESTAMP NULL;
