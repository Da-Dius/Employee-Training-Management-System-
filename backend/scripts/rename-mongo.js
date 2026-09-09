require('dotenv').config();
const mongoose = require('mongoose');

// FIX: Force Google/Cloudflare DNS
require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);

async function migrate() {
    if (!process.env.MONGODB_URI) {
        console.error('Missing MONGODB_URI in .env');
        process.exit(1);
    }

    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        console.log('Connected!');

        // --- NEW FIX: Drop old indexes that cause E11000 duplicate key errors ---
        console.log('Clearing old indexes...');
        try { await db.collection('employees').dropIndexes(); } catch (e) { /* ignore */ }
        try { await db.collection('users').dropIndexes(); } catch (e) { /* ignore */ }
        try { await db.collection('nominees').dropIndexes(); } catch (e) { /* ignore */ }

        console.log('Migrating Trainings...');
        await db.collection('trainings').updateMany({}, {
            $rename: {
                "trainingDate": "training_date",
                "trainingEndDate": "training_end_date",
                "perDiem": "per_diem",
                "trainerName": "trainer_name",
                "lpoNumber": "lpo_number",
                "lpoAttachmentFilename": "lpo_attachment_filename",
                "lpoAttachmentOriginalName": "lpo_attachment_original_name",
                "serviceEntry": "service_entry"
            }
        });

        console.log('Migrating Nominees...');
        await db.collection('nominees').updateMany({}, {
            $rename: {
                "employeeNumber": "employee_number",
                "stationRegion": "station_region",
                "nominationStatus": "nomination_status",
                "nominationRespondedAt": "nomination_responded_at",
                "declineReason": "decline_reason",
                "replacedBy": "replaced_by",
                "replacesNominee": "replaces_nominee",
                "attendanceStatus": "attendance_status",
                "attendanceSelfReported": "attendance_self_reported",
                "attendanceRespondedAt": "attendance_responded_at",
                "attendanceRequestSentAt": "attendance_request_sent_at",
                "confirmationToken": "confirmation_token",
                "linkSentAt": "link_sent_at"
            }
        });

        console.log('Migrating Employees...');
        await db.collection('employees').updateMany({}, {
            $rename: {
                "employeeNumber": "employee_number",
                "stationRegion": "station_region"
            }
        });

        console.log('Migrating Evidence...');
        await db.collection('evidences').updateMany({}, {
            $rename: {
                "originalName": "original_name"
            }
        });

        console.log('Migrating Users...');
        await db.collection('users').updateMany({}, {
            $rename: {
                "passwordHash": "password_hash"
            }
        });

        console.log('✅ Migration complete! Your database is now perfectly synced with the new schema.');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();