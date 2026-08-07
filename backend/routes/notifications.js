const express = require('express');
const { mongoose, Training, Notification } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}


function nairobiDateString(daysOffset = 0) {
    const d = new Date(Date.now() + daysOffset * 86400000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
}

async function generateDueNotifications() {
    const todayStr = nairobiDateString(0);
    const tomorrowStr = nairobiDateString(1);

    const due = await Training.find({ trainingDate: { $in: [todayStr, tomorrowStr] } });

    await Promise.all(
        due.map((t) => {
            const isToday = t.trainingDate === todayStr;
            const message = `${t.name} starts ${isToday ? 'today' : 'tomorrow'}${t.venue ? ` at ${t.venue}` : ''}`;
            return Notification.updateOne(
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
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