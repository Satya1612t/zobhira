CREATE TABLE IF NOT EXISTS search_queries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query             TEXT NOT NULL UNIQUE,
    search_count      INTEGER NOT NULL DEFAULT 1,
    first_searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_searched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_queries_last_searched ON search_queries (last_searched_at DESC);
