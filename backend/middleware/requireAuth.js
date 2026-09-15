const { User } = require('../db/database');

// Besides checking for a session, confirms the user still exists and hasn't had their
// password reset since signing in, so removing a user or resetting a password signs
// them out everywhere.
async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  try {
    const user = await User.findById(req.session.userId).select('role session_version');
    if (!user || (req.session.sessionVersion ?? 0) !== user.session_version) {
      return req.session.destroy(() => {
        res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
      });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
