const fs = require('fs');
const path = require('path');

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;
  `);
}

function runMigrations(db, migrationsDir) {
  ensureMigrationTable(db);
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(row => row.version)
  );
  const files = fs.readdirSync(migrationsDir)
    .filter(name => /^\d+_.+\.sql$/.test(name))
    .sort();

  const apply = db.transaction((version, name, sql) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, name);
  });

  for (const file of files) {
    const version = file.split('_', 1)[0];
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    apply(version, file, sql);
    console.log(`Applied migration ${file}`);
  }
}

module.exports = { runMigrations };
