import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env.js";

mkdirSync(dirname(env.dbPath), { recursive: true });

export const db = new Database(env.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    jid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    participant_count INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    group_jid TEXT NOT NULL,
    group_name TEXT NOT NULL,
    sender_jid TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL,
    category TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    from_me INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_jid);
  CREATE INDEX IF NOT EXISTS idx_messages_category ON messages(category);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    group_jid TEXT NOT NULL,
    group_name TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    event_description TEXT NOT NULL,
    event_time INTEGER NOT NULL,
    remind_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, remind_at);

  CREATE TABLE IF NOT EXISTS digest_log (
    group_jid TEXT NOT NULL,
    period TEXT NOT NULL,
    last_sent_date TEXT NOT NULL,
    PRIMARY KEY (group_jid, period)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    subscription_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Added after the initial schema — guard against re-running on a db that
// already has the column (SQLite has no ADD COLUMN IF NOT EXISTS).
function addColumnIfMissing(table: string, column: string, definition: string): void {
  const exists = db
    .prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = @column`)
    .get({ column });
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("messages", "media_url", "TEXT");
addColumnIfMissing("messages", "content_label", "TEXT");
addColumnIfMissing("messages", "meeting_time", "INTEGER");

db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_meeting_time ON messages(meeting_time)`);

// Allowlist: a group does nothing at all until explicitly turned on — new
// groups the linked account joins default to fully inert (0, 0).
addColumnIfMissing("groups", "learn_enabled", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("groups", "respond_enabled", "INTEGER NOT NULL DEFAULT 0");
