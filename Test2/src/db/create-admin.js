const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { openDatabase } = require('./database');
const { runMigrations } = require('./migrate');
(async () => {
  const [name, password] = process.argv.slice(2);
  if (!name || !password || password.length < 3) {
    console.error('Usage: npm run user:create-admin -- "Admin Name" "password-at-least-10-characters"');
    process.exit(1);
  }
  const root = path.resolve(__dirname, '..', '..');
  const dataDir = path.resolve(process.env.PHIMS_DATA_DIR || path.join(root, 'data'));
  fs.mkdirSync(dataDir, { recursive: true });
  const db = openDatabase(path.resolve(process.env.PHIMS_DB_PATH || path.join(dataDir, 'phims.sqlite3')));
  runMigrations(db, path.join(__dirname, 'migrations'));
  const hash = await bcrypt.hash(password, 12);
  db.prepare(`INSERT INTO users(name,password_hash,is_admin,is_active) VALUES(?,?,1,1)
    ON CONFLICT(name) DO UPDATE SET password_hash=excluded.password_hash,is_admin=1,is_active=1,updated_at=CURRENT_TIMESTAMP`).run(name.trim(), hash);
  db.close();
  console.log(`Administrator ready: ${name.trim()}`);
})().catch(error => { console.error(error); process.exit(1); });
