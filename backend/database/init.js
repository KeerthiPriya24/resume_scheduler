const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'recruitment.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('recruiter', 'jobseeker')),
    bio TEXT,
    phone TEXT,
    location TEXT,
    company TEXT,
    avatar_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add new columns if they don't exist
const columns = db.prepare("PRAGMA table_info(users)").all();
const existingColumns = columns.map(c => c.name);
const newCols = [
  { name: 'bio', type: 'TEXT' },
  { name: 'phone', type: 'TEXT' },
  { name: 'location', type: 'TEXT' },
  { name: 'company', type: 'TEXT' },
  { name: 'avatar_path', type: 'TEXT' }
];

for (const col of newCols) {
  if (!existingColumns.includes(col.name)) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Migration: Added column ${col.name} to users table`);
    } catch (err) {
      console.error(`❌ Migration error (${col.name}):`, err.message);
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recruiter_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    required_skills TEXT DEFAULT '[]',
    experience_required INTEGER DEFAULT 0,
    positions INTEGER DEFAULT 1,
    shortlist_target INTEGER DEFAULT 4,
    confirmation_deadline_hours INTEGER DEFAULT 48,
    job_status TEXT DEFAULT 'open' CHECK (job_status IN ('open', 'closed', 'filled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    resume_path TEXT,
    resume_text TEXT,
    status TEXT DEFAULT 'pending_ai_processing' CHECK (status IN (
      'pending_ai_processing', 'processed', 'ranked',
      'pending_confirmation', 'shortlisted', 'buffer',
      'scheduling', 'confirmed', 'escalated',
      'selected', 'rejected', 'hold', 'withdrawn'
    )),
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS ai_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id),
    matched_skills TEXT DEFAULT '[]',
    missing_skills TEXT DEFAULT '[]',
    experience_score REAL DEFAULT 0,
    role_score REAL DEFAULT 0,
    overall_fit_score REAL DEFAULT 0,
    summary TEXT DEFAULT '',
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shortlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'auto_confirmed')),
    proposed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    confirmation_deadline DATETIME
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    scheduling_token TEXT UNIQUE,
    candidate_availability TEXT DEFAULT '[]',
    selected_slot TEXT,
    interview_status TEXT DEFAULT 'pending_scheduling' CHECK (interview_status IN (
      'pending_scheduling', 'availability_submitted', 'slot_proposed',
      'confirmed', 'completed', 'no_show', 'cancelled', 'escalated'
    )),
    negotiation_rounds INTEGER DEFAULT 0,
    max_negotiation_rounds INTEGER DEFAULT 3,
    scheduled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS recruiter_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recruiter_id INTEGER NOT NULL REFERENCES users(id),
    day_of_week INTEGER,
    start_time TEXT,
    end_time TEXT,
    specific_date TEXT,
    is_available INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    email_to TEXT,
    sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
  CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
  CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
  CREATE INDEX IF NOT EXISTS idx_ai_scores_app ON ai_scores(application_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id);
  CREATE INDEX IF NOT EXISTS idx_interviews_app ON interviews(application_id);
`);

console.log('✅ Database initialized successfully');

module.exports = db;
