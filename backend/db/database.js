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

// FIX 2: Globally configure Mongoose to output 'id' instead of '_id' and remove '__v'
mongoose.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const { Schema } = mongoose;

// ---------- Schemas ----------
// FIX 3: Updated all keys to snake_case to perfectly match the React frontend payload

const trainingSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  training_date: { type: String, required: true }, // Was trainingDate
  training_end_date: String,                       // Was trainingEndDate
  venue: String,
  cost: { type: Number, required: true, default: 0 },
  paid: { type: Boolean, default: false },
  per_diem: { type: Boolean, default: false },     // Was perDiem
  description: String,
  trainer_name: String,                            // Was trainerName
  lpo_number: String,                              // Was lpoNumber
  lpo_attachment_filename: String,                 // Was lpoAttachmentFilename
  lpo_attachment_original_name: String,            // Was lpoAttachmentOriginalName
  service_entry: { type: String, enum: ['Paid', 'Not Paid'], default: 'Not Paid' }, // Was serviceEntry
}, { timestamps: true });

const nomineeSchema = new Schema({
  training: { type: Schema.Types.ObjectId, ref: 'Training', required: true },
  name: { type: String, required: true },
  employee_number: { type: String, required: true }, // Was employeeNumber
  department: String,
  division: String,
  section: String,
  station_region: String,                            // Was stationRegion
  email: String,

  nomination_status: { type: String, enum: ['Pending', 'Accepted', 'Declined'], default: 'Pending' }, // Was nominationStatus
  nomination_responded_at: Date,                     // Was nominationRespondedAt
  decline_reason: String,                            // Was declineReason

  replaced_by: { type: Schema.Types.ObjectId, ref: 'Nominee' },        // Was replacedBy
  replaces_nominee: { type: Schema.Types.ObjectId, ref: 'Nominee' },   // Was replacesNominee

  attendance_status: { type: String, enum: ['Pending', 'Attended', 'Did Not Attend'], default: 'Pending' }, // Was attendanceStatus
  attendance_self_reported: { type: Boolean, default: false },         // Was attendanceSelfReported
  attendance_responded_at: Date,                     // Was attendanceRespondedAt
  attendance_request_sent_at: Date,                  // Was attendanceRequestSentAt

  confirmation_token: { type: String, unique: true, sparse: true },    // Was confirmationToken
  link_sent_at: Date,                                // Was linkSentAt
}, { timestamps: { createdAt: true, updatedAt: false } });

const employeeSchema = new Schema({
  name: { type: String, required: true },
  employee_number: { type: String, required: true, unique: true }, // Was employeeNumber
  department: String,
  division: String,
  section: String,
  station_region: String,                            // Was stationRegion
  email: String,
}, { timestamps: true });

const evidenceSchema = new Schema({
  training: { type: Schema.Types.ObjectId, ref: 'Training', required: true },
  filename: { type: String, required: true },
  original_name: { type: String, required: true },   // Was originalName
  size: Number,
}, { timestamps: { createdAt: 'uploadedAt', updatedAt: false } });

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password_hash: { type: String, required: true },   // Was passwordHash
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
}, { timestamps: { createdAt: true, updatedAt: false } });

const notificationSchema = new Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  refId: { type: Schema.Types.ObjectId },
  read: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ type: 1, refId: 1 }, { unique: true });

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
const Notification = mongoose.model('Notification', notificationSchema);
const Setting = mongoose.model('Setting', settingSchema);

// ---------- Helpers ----------

function genToken() {
  return crypto.randomBytes(16).toString('hex');
}

function nairobiDateString(daysOffset = 0) {
  const d = new Date(Date.now() + daysOffset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
}

// Fixed to handle the snake_case keys
function hasTrainingEnded(training_date, training_end_date) {
  return (training_end_date || training_date) < nairobiDateString();
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

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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
  Notification,
  Setting,
  genToken,
  nairobiDateString,
  hasTrainingEnded,
  hashPassword,
  verifyPassword,
  initSessionSecret,
  getInviteCode,
  regenerateInviteCode,
};