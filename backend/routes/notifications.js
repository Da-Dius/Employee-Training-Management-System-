const express = require('express');
const { Training, Notification, nairobiDateString } = require('../db/database');
const { asyncHandler, isValidId } = require('../lib/http');

const router = express.Router();

async function generateDueNotifications() {
    const todayStr = nairobiDateString(0);
    const tomorrowStr = nairobiDateString(1);

    const due = await Training.find({ training_date: { $in: [todayStr, tomorrowStr] } });

    await Promise.all(
        due.map(async (t) => {
            const isToday = t.training_date === todayStr;
            const message = `${t.name} starts ${isToday ? 'today' : 'tomorrow'}${t.venue ? ` at ${t.venue}` : ''}`;
            try {
                await Notification.updateOne(
                    { type: 'training_starting', refId: t._id },
                    {
                        $setOnInsert: {
                            type: 'training_starting',
                            refId: t._id,
                            message,
                            link: `/trainings/${t._id}`,
                            read_by: [],
                        },
                    },
                    { upsert: true }
                );
            } catch (err) {
                // Two HR users polling at the same moment can both try to insert it; one insert wins
                if (err?.code !== 11000) throw err;
            }
        })
    );
}

// `read` is from the point of view of the signed-in user
function serializeNotification(doc, userId) {
    return {
        id: doc._id,
        type: doc.type,
        message: doc.message,
        link: doc.link,
        read: (doc.read_by || []).some((id) => String(id) === userId),
        created_at: doc.createdAt,
    };
}

router.get('/', asyncHandler(async (req, res) => {
    await generateDueNotifications();
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(30);
    res.json(notifications.map((n) => serializeNotification(n, req.session.userId)));
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(404).json({ error: 'Notification not found' });
    }
    await Notification.updateOne({ _id: req.params.id }, { $addToSet: { read_by: req.session.userId } });
    res.status(204).end();
}));

// Marks everything read for the signed-in user only
router.post('/read-all', asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { read_by: { $ne: req.session.userId } },
        { $addToSet: { read_by: req.session.userId } }
    );
    res.status(204).end();
}));

module.exports = router;
