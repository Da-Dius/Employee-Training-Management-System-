const { User } = require('../db/database');

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