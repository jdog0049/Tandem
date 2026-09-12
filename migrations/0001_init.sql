PRAGMA foreign_keys = ON;

CREATE TABLE pairs (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'coral',
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE cycles (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  chosen_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_topics_cycle_slot ON topics(cycle_id, slot);
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  prompt TEXT,
  options_json TEXT,
  correct_answer TEXT
);
CREATE UNIQUE INDEX idx_lessons_cycle_topic_day ON lessons(cycle_id, topic_id, day_number);
CREATE TABLE progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  answer TEXT,
  is_correct INTEGER,
  completed_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_progress_user_lesson ON progress(user_id, lesson_id);
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  detail TEXT
);
CREATE UNIQUE INDEX idx_challenges_cycle_day ON challenges(cycle_id, day_number);
CREATE TABLE challenge_answers (
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_challenge_answers_user ON challenge_answers(challenge_id, user_id);
CREATE INDEX idx_users_pair ON users(pair_id);
CREATE INDEX idx_cycles_pair_created ON cycles(pair_id, created_at);
CREATE INDEX idx_lessons_cycle_day ON lessons(cycle_id, day_number);
CREATE INDEX idx_progress_lesson ON progress(lesson_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
PRAGMA optimize;
