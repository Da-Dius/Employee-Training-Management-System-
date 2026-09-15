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
                            read: false,
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

function serializeNotification(doc) {
    return {
        id: doc._id,
        type: doc.type,
        message: doc.message,
        link: doc.link,
        read: doc.read,
        created_at: doc.createdAt,
    };
}

router.get('/', asyncHandler(async (req, res) => {
    await generateDueNotifications();
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(30);
    res.json(notifications.map(serializeNotification));
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(404).json({ error: 'Notification not found' });
    }
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.status(204).end();
}));

router.post('/read-all', asyncHandler(async (req, res) => {
    await Notification.updateMany({ read: false }, { read: true });
    res.status(204).end();
}));

module.exports = router;
