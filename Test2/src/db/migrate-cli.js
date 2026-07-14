const path = require('path');
const fs = require('fs');
const { openDatabase } = require('./database');
const { runMigrations } = require('./migrate');

const root = path.resolve(__dirname, '..', '..');
const dataDir = path.resolve(process.env.PHIMS_DATA_DIR || path.join(root, 'data'));
const dbPath = path.resolve(process.env.PHIMS_DB_PATH || path.join(dataDir, 'phims.sqlite3'));
fs.mkdirSync(dataDir, { recursive: true });
const db = openDatabase(dbPath);
runMigrations(db, path.join(__dirname, 'migrations'));
db.close();
console.log(`Database ready: ${dbPath}`);
