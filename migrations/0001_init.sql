CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_url TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  published_at TEXT,
  text_content TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'crawled',
  created_at INTEGER NOT NULL
);
CREATE INDEX documents_source_idx ON documents(source_id);
CREATE INDEX documents_status_idx ON documents(status);

CREATE TABLE crawl_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  provider TEXT NOT NULL,
  provider_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  pages_found INTEGER NOT NULL DEFAULT 0,
  pages_stored INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX crawl_jobs_status_idx ON crawl_jobs(status);

CREATE TABLE pangram_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_chars INTEGER NOT NULL DEFAULT 0,
  task_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  fraction_ai REAL,
  fraction_ai_assisted REAL,
  prediction TEXT,
  prediction_short TEXT,
  raw TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX pangram_tasks_status_idx ON pangram_tasks(status);
CREATE INDEX pangram_tasks_document_idx ON pangram_tasks(document_id);
