ALTER TABLE incidents ADD COLUMN commander_id VARCHAR(64);
ALTER TABLE incidents ADD COLUMN commander_name VARCHAR(255);
ALTER TABLE incidents ADD COLUMN environment VARCHAR(255);
ALTER TABLE incidents ADD COLUMN region VARCHAR(255);
ALTER TABLE incidents ADD COLUMN business_impact VARCHAR(500);
ALTER TABLE incidents ADD COLUMN context_notes VARCHAR(2000);

CREATE TABLE incident_affected_components (
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    component   VARCHAR(255) NOT NULL
);
CREATE INDEX idx_incident_affected_components_incident_id ON incident_affected_components (incident_id);

CREATE TABLE incident_participants (
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    user_id     VARCHAR(64) NOT NULL,
    user_name   VARCHAR(255) NOT NULL
);
CREATE INDEX idx_incident_participants_incident_id ON incident_participants (incident_id);

CREATE TABLE incident_timeline_entries (
    id          VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    type        VARCHAR(32) NOT NULL,
    note        VARCHAR(1000),
    actor_id    VARCHAR(64),
    actor_name  VARCHAR(255),
    created_at  TIMESTAMP NOT NULL
);
CREATE INDEX idx_incident_timeline_entries_incident_id ON incident_timeline_entries (incident_id);
