const express = require('express');
const { Training, Evidence } = require('../db/database');
const requireAdmin = require('../middleware/requireAdmin');
const { asyncHandler, isValidId } = require('../lib/http');
const { sendStoredFile, deleteStoredFile } = require('../storage/gridfs');
const { upload } = require('../storage/upload');

const router = express.Router({ mergeParams: true });

// Keeps the same snake_case JSON shape the frontend already expects.
function serialize(doc) {
  return {
    id: doc._id,
    training_id: doc.training,
    filename: doc.filename,
    original_name: doc.original_name,
    size: doc.size,
    uploaded_at: doc.uploadedAt,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.json([]);
  const docs = await Evidence.find({ training: req.params.trainingId }).sort({ uploadedAt: -1 });
  res.json(docs.map(serialize));
}));

router.post('/', upload.array('files', 10), asyncHandler(async (req, res) => {
  const files = req.files || [];

  const training = isValidId(req.params.trainingId)
    ? await Training.findById(req.params.trainingId).select('_id')
    : null;
  if (!training) {
    // multer stores files before this handler runs, so discard them
    files.forEach((f) => deleteStoredFile(f.filename));
    return res.status(404).json({ error: 'Program not found' });
  }

  const inserted = await Promise.all(
    files.map((f) =>
      Evidence.create({
        training: req.params.trainingId,
        filename: f.filename,
        original_name: f.originalname,
        size: f.size,
      })
    )
  );

  res.status(201).json(inserted.map(serialize));
}));

router.get('/:evidenceId/download', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.evidenceId)) {
    return res.status(404).json({ error: 'Evidence not found' });
  }
  const doc = await Evidence.findOne({ _id: req.params.evidenceId, training: req.params.trainingId });
  if (!doc) return res.status(404).json({ error: 'Evidence not found' });

  await sendStoredFile(res, doc.filename, doc.original_name);
}));

// Evidence files are compliance records, so only admins can delete them.
router.delete('/:evidenceId', requireAdmin, asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.evidenceId)) {
    return res.status(404).json({ error: 'Evidence not found' });
  }
  const doc = await Evidence.findOne({ _id: req.params.evidenceId, training: req.params.trainingId });
  if (!doc) return res.status(404).json({ error: 'Evidence not found' });

  await Evidence.deleteOne({ _id: req.params.evidenceId });
  deleteStoredFile(doc.filename);
  res.status(204).end();
}));

module.exports = router;
