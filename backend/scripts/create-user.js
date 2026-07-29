// Bootstrap or add an HR staff login account.
// Usage: node scripts/create-user.js <username> <password> <full name>
const { db, hashPassword } = require('../db/database');

const [, , username, password, ...nameParts] = process.argv;
const name = nameParts.join(' ');

if (!username || !password || !name) {
  console.error('Usage: node scripts/create-user.js <username> <password> <full name>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const normalizedUsername = username.trim().toLowerCase();
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
if (existing) {
  console.error(`A user with username "${normalizedUsername}" already exists`);
  process.exit(1);
}

db.prepare('INSERT INTO users (username, name, password_hash) VALUES (?, ?, ?)').run(
  normalizedUsername,
  name.trim(),
  hashPassword(password)
);

console.log(`Created HR user "${normalizedUsername}" (${name.trim()})`);
