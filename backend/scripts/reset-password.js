// Reset an HR user's password from the command line — for when nobody else is
// signed in to reset it for them from the HR Users page.
// Usage: node scripts/reset-password.js <username> <new-password>
//
// dotenv first, before db/database.js: that module reads MONGODB_URI at require time
// and throws if it is missing.
require('dotenv').config({ quiet: true });

const { mongoose, User, hashPassword } = require('../db/database');

async function main() {
  const [, , username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.error('Usage: node scripts/reset-password.js <username> <new-password>');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  await mongoose.connection.asPromise();

  const normalizedUsername = username.trim().toLowerCase();
  const result = await User.updateOne(
    { username: normalizedUsername },
    { $set: { passwordHash: hashPassword(newPassword) } }
  );

  if (result.matchedCount === 0) {
    console.error(`No user found with username "${normalizedUsername}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Password reset for HR user "${normalizedUsername}"`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exit(1);
});
