require('dotenv').config({ quiet: true });

const { mongoose, User, hashPassword } = require('../db/database');

async function main() {
  const args = process.argv.slice(2);

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

  await mongoose.connection.asPromise();

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    console.error(`A user with username "${normalizedUsername}" already exists`);
    await mongoose.disconnect();
    process.exit(1);
  }

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
