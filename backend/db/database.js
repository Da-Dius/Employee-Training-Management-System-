const mongoose = require('mongoose');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');


require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });


const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not set. Add it to your environment (.env locally, Render dashboard in production).');
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const { Schema } = mongoose;

// ---------- Schemas ----------

const trainingSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  trainingDate: { type: String, required: true },
  venue: String,
  cost: { type: Number, required: true, default: 0 },
  paid: { type: Boolean, default: false },
  perDiem: { type: Boolean, default: false },
  description: String,
}, { timestamps: true });

const nomineeSchema = new Schema({
  training: { type: Schema.Types.ObjectId, ref: 'Training', required: true },
  name: { type: String, required: true },
  employeeNumber: { type: String, required: true },
  department: String,
  division: String,
  section: String,
  stationRegion: String,
  email: String,
  attendanceStatus: { type: String, default: 'Pending' },
  employeeConfirmed: { type: Boolean, default: false },
  confirmationToken: { type: String, unique: true, sparse: true }, // sparse allows many nulls
}, { timestamps: { createdAt: true, updatedAt: false } });

const employeeSchema = new Schema({
  name: { type: String, required: true },
  employeeNumber: { type: String, required: true, unique: true },
  department: String,
  division: String,
  section: String,
  stationRegion: String,
  email: String,
}, { timestamps: true });

const evidenceSchema = new Schema({
  training: { type: Schema.Types.ObjectId, ref: 'Training', required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: Number,
}, { timestamps: { createdAt: 'uploadedAt', updatedAt: false } });

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
});


// ---------- Models ----------

const Training = mongoose.model('Training', trainingSchema);
const Nominee = mongoose.model('Nominee', nomineeSchema);
const Employee = mongoose.model('Employee', employeeSchema);
const Evidence = mongoose.model('Evidence', evidenceSchema);
const User = mongoose.model('User', userSchema);
const Setting = mongoose.model('Setting', settingSchema);

// ---------- Helpers (same interface as before, now async) ----------

function genToken() {
  return crypto.randomBytes(16).toString('hex');
}

async function getSetting(key) {
  const doc = await Setting.findOne({ key });
  return doc?.value;
}

async function setSetting(key, value) {
  await Setting.findOneAndUpdate(
    { key },
    { value },
    { upsert: true }
  );
}

async function getOrCreateSetting(key, factory) {
  const existing = await getSetting(key);
  if (existing !== undefined) return existing;
  const value = factory();
  await setSetting(key, value);
  return value;
}

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid ambiguity

function generateInviteCode() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

async function getInviteCode() {
  return getOrCreateSetting('invite_code', generateInviteCode);
}

async function regenerateInviteCode() {
  const code = generateInviteCode();
  await setSetting('invite_code', code);
  return code;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// sessionSecret used to be computed once at startup (synchronously). Since Mongo access
// is now async, server.js needs to await this before starting the app — see note below.
async function initSessionSecret() {
  return getOrCreateSetting('session_secret', () => crypto.randomBytes(32).toString('hex'));
}

module.exports = {
  mongoose,
  uploadsDir,
  Training,
  Nominee,
  Employee,
  Evidence,
  User,
  Setting,
  genToken,
  hashPassword,
  verifyPassword,
  initSessionSecret,
  getInviteCode,
  regenerateInviteCode,
};