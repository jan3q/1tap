import Database from 'better-sqlite3';
import path from 'path';

import fs from 'fs';

// Połącz do lokalnej bazy danych (w głównym folderze aplikacji jako dev.db)
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'dev.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Używamy globalnego singletonu, aby uniknąć wielokrotnego tworzenia i zamykania
// połączenia better-sqlite3 podczas hot-reload'u w trybie deweloperskim (Next.js),
// co powodowało błąd "Connection closed." przy server actions.
const globalForDb = globalThis as unknown as { __db?: Database.Database };

const db = globalForDb.__db ?? new Database(dbPath);
if (!globalForDb.__db) {
  globalForDb.__db = db;
}

// Inicjalizacja schematu
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      views INTEGER DEFAULT 0,
      submissions INTEGER DEFAULT 0,
      redirect_url TEXT,
      webhook_url TEXT,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
    );
  `);

  // Migracja: dodaj kolumnę description, jeśli brakuje (dla istniejących baz)
  const cols = db.prepare("PRAGMA table_info(surveys)").all() as { name: string }[];
  if (!cols.some(c => c.name === 'description')) {
    db.exec("ALTER TABLE surveys ADD COLUMN description TEXT DEFAULT ''");
  }
};

initDb();

export default db;
