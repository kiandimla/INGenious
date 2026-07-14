const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadOrCreateSessionSecret(dataDir) {
  const filename = path.join(dataDir, '.session-secret');
  try {
    const value = fs.readFileSync(filename, 'utf8').trim();
    if (value.length >= 32) return value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const secret = crypto.randomBytes(48).toString('base64url');
  try {
    fs.writeFileSync(filename, `${secret}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return secret;
  } catch (error) {
    if (error.code === 'EEXIST') return fs.readFileSync(filename, 'utf8').trim();
    throw error;
  }
}
module.exports = { loadOrCreateSessionSecret };
