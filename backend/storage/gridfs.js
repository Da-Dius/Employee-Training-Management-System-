const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { mongoose, uploadsDir } = require('../db/database');

const BUCKET_NAME = 'uploads';

// mongoose.connection.db only exists once the connection is open. Buckets are cheap,
// so create one per call instead of caching a handle from before the connection.
function getBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

function generateFilename(originalName) {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(originalName)}`;
}

// Multer storage engine that streams each upload straight into GridFS, so files survive
// restarts and redeploys (Render wipes the local disk on both).
function gridfsStorage() {
  return {
    _handleFile(req, file, cb) {
      const filename = generateFilename(file.originalname);
      const uploadStream = getBucket().openUploadStream(filename, {
        metadata: { original_name: file.originalname, content_type: file.mimetype },
      });

      pipeline(file.stream, uploadStream)
        .then(() => cb(null, { filename, gridfsId: uploadStream.id, size: uploadStream.length }))
        .catch((err) => {
          uploadStream.abort().catch(() => { });
          cb(err);
        });
    },

    // Called by multer when a request fails after some files were stored (e.g. size limit).
    _removeFile(req, file, cb) {
      if (!file.gridfsId) return cb(null);
      getBucket().delete(file.gridfsId).then(() => cb(null), () => cb(null));
    },
  };
}

// Streams a stored file as a download. Files saved before the move to GridFS still live in
// the local uploads folder until scripts/migrate-uploads-to-gridfs.js copies them across.
async function sendStoredFile(res, filename, downloadName) {
  const file = await getBucket().find({ filename }).limit(1).next();

  if (file) {
    res.attachment(downloadName || filename);
    res.setHeader('Content-Length', file.length);
    await pipeline(getBucket().openDownloadStream(file._id), res);
    return;
  }

  const legacyPath = path.join(uploadsDir, path.basename(filename));
  if (fs.existsSync(legacyPath)) {
    await new Promise((resolve, reject) => {
      res.download(legacyPath, downloadName, (err) => (err ? reject(err) : resolve()));
    });
    return;
  }

  res.status(404).json({ error: 'File not found. It may have been uploaded before file storage moved to the database.' });
}

// Fire-and-forget, like fs.unlink(..., () => {}): a missing file is not an error.
function deleteStoredFile(filename) {
  if (!filename) return Promise.resolve();
  return (async () => {
    const bucket = getBucket();
    const files = await bucket.find({ filename }).toArray();
    await Promise.all(files.map((f) => bucket.delete(f._id)));
    fs.unlink(path.join(uploadsDir, path.basename(filename)), () => { });
  })().catch((err) => console.error('Failed to delete stored file', filename, err));
}

module.exports = { BUCKET_NAME, getBucket, gridfsStorage, sendStoredFile, deleteStoredFile };
