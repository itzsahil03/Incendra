-- Monotonic-safe: every row already satisfying id-alone uniqueness automatically
-- satisfies the (id, org_id) pair too, so no backfill is needed.
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_pkey;
ALTER TABLE user_profiles ADD CONSTRAINT pk_user_profiles PRIMARY KEY (id, org_id);
