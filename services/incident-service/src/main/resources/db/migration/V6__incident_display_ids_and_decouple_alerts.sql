-- Human-readable incident IDs (INC000001-style), backfilled in creation order per org.
ALTER TABLE incidents ADD COLUMN display_id VARCHAR(20);

CREATE TABLE incident_counters (
    org_id     VARCHAR(64) PRIMARY KEY,
    next_value BIGINT NOT NULL DEFAULT 1
);

WITH numbered AS (
    SELECT id, org_id, ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at) AS rn
    FROM incidents
)
UPDATE incidents i
SET display_id = 'INC' || LPAD(numbered.rn::text, 6, '0')
FROM numbered
WHERE i.id = numbered.id;

ALTER TABLE incidents ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE incidents ADD CONSTRAINT uq_incidents_display_id UNIQUE (display_id);

INSERT INTO incident_counters (org_id, next_value)
SELECT org_id, COUNT(*) + 1 FROM incidents GROUP BY org_id;

-- Alerts and incidents are now independent entities (see Alert.incidentId in
-- alert-ingestion-service, which owns the relationship as a one-to-many: one incident
-- can have multiple linked alerts, an alert belongs to at most one incident). Incidents
-- no longer track "the alert that created them" on their own side.
ALTER TABLE incidents DROP COLUMN IF EXISTS alert_id;
