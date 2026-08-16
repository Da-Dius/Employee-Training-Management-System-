const { User } = require('../db/database');

// Assumes requireAuth already ran and confirmed req.session.userId exists — this only
// adds the extra "and that user is an admin" check on top, for the handful of routes
// that need it (creating/deleting HR users, resetting someone else's password,
// regenerating the invite code). Every other authenticated route stays open to any
// signed-in staff member, unchanged.
async function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not signed in' });
    }
    const user = await User.findById(req.session.userId).select('role');
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = requireAdmin;