const rateLimit = require('express-rate-limit');

// Throttles login/signup/password-reset attempts per IP to slow down brute-forcing
// passwords or invite codes. Generous enough not to bother a real HR user who mistypes.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

module.exports = authRateLimiter;
