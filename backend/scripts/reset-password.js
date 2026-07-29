// Reset an HR user's password from the command line — for when nobody else is
// signed in to reset it for them from the HR Users page.
// Usage: node scripts/reset-password.js <username> <new-password>
const { db, hashPassword } = require('../db/database');

const [, , username, newPassword] = process.argv;

if (!username || !newPassword) {
  console.error('Usage: node scripts/reset-password.js <username> <new-password>');
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const normalizedUsername = username.trim().toLowerCase();
const user = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
if (!user) {
  console.error(`No user found with username "${normalizedUsername}"`);
  process.exit(1);
}

db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);

console.log(`Password reset for HR user "${normalizedUsername}"`);
