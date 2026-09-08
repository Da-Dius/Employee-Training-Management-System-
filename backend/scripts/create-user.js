// Bootstrap or add an HR staff login account.
// Usage: node scripts/create-user.js <username> <password> <full name> [--admin]
//
// dotenv is loaded here, before db/database.js: that module reads MONGODB_URI at require
// time and throws if it is missing, so the config has to be in place first. server.js
// does the same thing for the same reason.
require('dotenv').config({ quiet: true });

const { mongoose, User, hashPassword } = require('../db/database');

async function main() {
  const args = process.argv.slice(2);

  // Pulled out before positional parsing so it can be passed anywhere on the line
  // without being swallowed by the multi-word full name.
  const forceAdmin = args.includes('--admin');
  const [username, password, ...nameParts] = args.filter((a) => a !== '--admin');
  const name = nameParts.join(' ');

  if (!username || !password || !name) {
    console.error('Usage: node scripts/create-user.js <username> <password> <full name> [--admin]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  // db/database.js kicks off mongoose.connect() at require time and exits the process
  // itself if it fails, so this only has to wait for it to land.
  await mongoose.connection.asPromise();

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    console.error(`A user with username "${normalizedUsername}" already exists`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Mirrors the signup route in routes/auth.js: the very first account on the system
  // becomes admin automatically, because otherwise nobody could ever manage HR users.
  // After that, staff unless --admin is passed.
  const isFirstAccount = (await User.countDocuments()) === 0;
  const role = isFirstAccount || forceAdmin ? 'admin' : 'staff';

  await User.create({
    username: normalizedUsername,
    name: name.trim(),
    passwordHash: hashPassword(password),
    role,
  });

  console.log(`Created HR user "${normalizedUsername}" (${name.trim()}) with role ${role}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  // A duplicate key here means someone created the same username between the check
  // above and the insert — report it in the same terms rather than as a stack trace.
  if (err && err.code === 11000) {
    console.error('That username is already taken');
  } else {
    console.error(err);
  }
  try {
    await mongoose.disconnect();
  } catch {
    /* already down */
  }
  process.exit(1);
});
