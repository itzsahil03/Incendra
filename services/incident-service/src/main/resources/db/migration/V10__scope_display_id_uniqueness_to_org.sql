-- display_id (INC000001, ...) is minted from a per-org counter (IncidentIdGenerator),
-- so it was only ever guaranteed unique within an org — but the original V6 constraint
-- enforced global uniqueness instead. In a real multi-org deployment, any second org's
-- Nth incident collides with some other org's already-existing Nth incident and 500s on
-- creation. Rescope the constraint to match the actual uniqueness guarantee.
ALTER TABLE incidents DROP CONSTRAINT uq_incidents_display_id;
ALTER TABLE incidents ADD CONSTRAINT uq_incidents_org_display_id UNIQUE (org_id, display_id);
