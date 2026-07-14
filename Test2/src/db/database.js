const Database = require('better-sqlite3');

function openDatabase(filename) {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('trusted_schema = OFF');
  return db;
}

module.exports = { openDatabase };
