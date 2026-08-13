ALTER TABLE incidents RENAME COLUMN commander_id TO reporter_id;
ALTER TABLE incidents RENAME COLUMN commander_name TO reporter_name;

-- Keep pre-existing timeline rows readable under the renamed enum constant.
UPDATE incident_timeline_entries SET type = 'REPORTER_ASSIGNED' WHERE type = 'COMMANDER_ASSIGNED';
