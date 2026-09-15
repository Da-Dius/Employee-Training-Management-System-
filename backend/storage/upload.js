const multer = require('multer');
const { gridfsStorage } = require('./gridfs');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
]);

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Unsupported file type. Allowed: images, PDF, Word, Excel, PowerPoint, CSV, or plain text.'));
}

// Shared by LPO attachments and evidence files: stored in GridFS, 25MB max each.
// server.js turns the size and type errors into 413 / 400 responses.
const upload = multer({
  storage: gridfsStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter,
});

module.exports = { upload };
