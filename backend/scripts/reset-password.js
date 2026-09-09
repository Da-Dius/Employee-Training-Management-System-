
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
