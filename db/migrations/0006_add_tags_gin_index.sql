CREATE INDEX IF NOT EXISTS idx_jobs_tags ON jobs USING gin (tags);
