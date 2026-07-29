const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const {
    mongoose,
    Training,
    Nominee,
    Evidence,
    User,
    Setting,
} = require('../db/database');

const FORCE = process.argv.includes('--force');

const sqlitePath = process.env.SQLITE_PATH
    ? path.resolve(process.env.SQLITE_PATH)
    : path.join(__dirname, '..', 'db', 'hrms.sqlite');

async function main() {
    if (!fs.existsSync(sqlitePath)) {
        console.error(`No SQLite file found at ${sqlitePath}`);
        console.error('Set SQLITE_PATH if your file lives somewhere else.');
        process.exit(1);
    }

    // Wait for the Mongo connection triggered by requiring db/database.js above.
    await mongoose.connection.asPromise();
    console.log(`Connected to Mongo. Reading SQLite from ${sqlitePath}`);

    const existingCounts = await Promise.all([
        Training.countDocuments(),
        Nominee.countDocuments(),
        User.countDocuments(),
    ]);
    const alreadyHasData = existingCounts.some((c) => c > 0);
    if (alreadyHasData && !FORCE) {
        console.error('Atlas already has data in trainings/nominees/users. Aborting to avoid duplicates.');
        console.error('Re-run with --force if you really want to proceed anyway.');
        await mongoose.disconnect();
        process.exit(1);
    }

    const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

    // ---------- Settings (session_secret, invite_code) ----------
    const settingsRows = sqlite.prepare('SELECT key, value FROM settings').all();
    for (const row of settingsRows) {
        await Setting.findOneAndUpdate(
            { key: row.key },
            { value: row.value },
            { upsert: true }
        );
    }
    console.log(`Settings migrated: ${settingsRows.length}`);

    // ---------- Users ----------
    const userRows = sqlite.prepare('SELECT * FROM users').all();
    for (const row of userRows) {
        await User.create(
            [{
                username: row.username,
                name: row.name,
                passwordHash: row.password_hash,
                createdAt: new Date(row.created_at),
            }],
            { timestamps: false }
        );
    }
    console.log(`Users migrated: ${userRows.length}`);

    // ---------- Trainings (build old-id -> new-ObjectId map) ----------
    const trainingRows = sqlite.prepare('SELECT * FROM trainings').all();
    const trainingIdMap = new Map();

    for (const row of trainingRows) {
        const [doc] = await Training.create(
            [{
                name: row.name,
                category: row.category,
                trainingDate: row.training_date,
                venue: row.venue,
                cost: row.cost,
                paid: !!row.paid,
                perDiem: !!row.per_diem,
                description: row.description,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
            }],
            { timestamps: false }
        );
        trainingIdMap.set(row.id, doc._id);
    }
    console.log(`Trainings migrated: ${trainingRows.length}`);

    // ---------- Nominees ----------
    const nomineeRows = sqlite.prepare('SELECT * FROM nominees').all();
    let skippedNominees = 0;

    for (const row of nomineeRows) {
        const newTrainingId = trainingIdMap.get(row.training_id);
        if (!newTrainingId) {
            skippedNominees += 1;
            continue; // orphaned row with no matching training — shouldn't happen, but don't crash the run
        }
        await Nominee.create(
            [{
                training: newTrainingId,
                name: row.name,
                employeeNumber: row.employee_number,
                department: row.department,
                division: row.division,
                section: row.section,
                stationRegion: row.station_region,
                email: row.email,
                attendanceStatus: row.attendance_status,
                employeeConfirmed: !!row.employee_confirmed,
                confirmationToken: row.confirmation_token,
                createdAt: new Date(row.created_at),
            }],
            { timestamps: false }
        );
    }
    console.log(`Nominees migrated: ${nomineeRows.length - skippedNominees}${skippedNominees ? ` (skipped ${skippedNominees} orphaned rows)` : ''}`);

    // ---------- Evidence ----------
    const evidenceRows = sqlite.prepare('SELECT * FROM evidence').all();
    let skippedEvidence = 0;

    for (const row of evidenceRows) {
        const newTrainingId = trainingIdMap.get(row.training_id);
        if (!newTrainingId) {
            skippedEvidence += 1;
            continue;
        }
        await Evidence.create(
            [{
                training: newTrainingId,
                filename: row.filename,
                originalName: row.original_name,
                size: row.size,
                uploadedAt: new Date(row.uploaded_at),
            }],
            { timestamps: false }
        );
    }
    console.log(`Evidence records migrated: ${evidenceRows.length - skippedEvidence}${skippedEvidence ? ` (skipped ${skippedEvidence} orphaned rows)` : ''}`);
    console.log('NOTE: only DB records moved — the actual uploaded files still need to be copied to wherever uploadsDir points, or migrated to R2.');

    sqlite.close();
    await mongoose.disconnect();
    console.log('Migration complete.');
}

main().catch(async (err) => {
    console.error('Migration failed:', err);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});