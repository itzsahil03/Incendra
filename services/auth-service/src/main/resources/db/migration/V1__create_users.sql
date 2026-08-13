CREATE TABLE users (
    id             VARCHAR(64) PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    name           VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    org_id         VARCHAR(64)  NOT NULL,
    role           VARCHAR(32)  NOT NULL,
    created_at     TIMESTAMP NOT NULL
);
