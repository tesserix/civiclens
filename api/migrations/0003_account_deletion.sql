SET lock_timeout = '5s';
SET statement_timeout = '30s';
ALTER TABLE users ADD COLUMN identity_subject text CHECK (length(identity_subject) BETWEEN 1 AND 200);
CREATE TABLE account_deletion_requests (
    id uuid PRIMARY KEY,
    user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    due_at timestamptz NOT NULL DEFAULT now() + interval '720 hours',
    completed_at timestamptz,
    completion_reference text,
    CHECK (due_at = requested_at + interval '720 hours'),
    CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
    CHECK ((status = 'completed') = (completion_reference IS NOT NULL)),
    CHECK (completion_reference IS NULL OR length(completion_reference) BETWEEN 1 AND 200),
    CHECK (user_id IS NOT NULL OR status = 'completed')
);
CREATE INDEX account_deletion_pending ON account_deletion_requests(due_at) WHERE status = 'pending';
