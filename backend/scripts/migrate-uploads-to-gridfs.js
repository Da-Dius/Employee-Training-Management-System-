require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { mongoose, uploadsDir, Training, Evidence } = require('../db/database');
const { getBucket } = require('../storage/gridfs');

// Copies LPO attachments and evidence files from the local uploads folder into GridFS.
// Safe to re-run: files already in GridFS are skipped. Local files are left in place;
// delete them yourself once downloads work from the app.
async function main() {
  await mongoose.connection.asPromise();
  const bucket = getBucket();

  const trainings = await Training.find({ lpo_attachment_filename: { $nin: [null, ''] } })
    .select('lpo_attachment_filename lpo_attachment_original_name');
  const evidence = await Evidence.find().select('filename original_name');

  const refs = [
    ...trainings.map((t) => ({ filename: t.lpo_attachment_filename, original_name: t.lpo_attachment_original_name })),
    ...evidence.map((e) => ({ filename: e.filename, original_name: e.original_name })),
  ];

  const counts = { copied: 0, alreadyInGridfs: 0, missingLocally: 0 };

  for (const ref of refs) {
    if (await bucket.find({ filename: ref.filename }).limit(1).hasNext()) {
      counts.alreadyInGridfs++;
      continue;
    }

    const localPath = path.join(uploadsDir, path.basename(ref.filename));
    if (!fs.existsSync(localPath)) {
      counts.missingLocally++;
      console.warn(`Missing locally: ${ref.filename} (${ref.original_name})`);
      continue;
    }

    await pipeline(
      fs.createReadStream(localPath),
      bucket.openUploadStream(ref.filename, { metadata: { original_name: ref.original_name } })
    );
    counts.copied++;
    console.log(`Copied ${ref.filename} (${ref.original_name})`);
  }

  console.log(
    `Done. ${refs.length} file reference(s): copied ${counts.copied}, ` +
    `already in GridFS ${counts.alreadyInGridfs}, missing locally ${counts.missingLocally}.`
  );
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
