ALTER TABLE auth_challenges DROP CONSTRAINT auth_challenges_provider_check;
ALTER TABLE auth_challenges ADD CONSTRAINT auth_challenges_provider_check
    CHECK (provider IN ('google', 'facebook', 'apple'));
