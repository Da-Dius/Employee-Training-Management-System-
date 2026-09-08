const rateLimit = require('express-rate-limit');

// Separate from authRateLimiter on purpose. That one guards login and is deliberately
// tight (20 attempts / 15 min in production). The public confirm flow now asks each
// employee two questions across two visits, and the limiter is keyed on IP behind
// `trust proxy: 1` — so a whole department answering from behind one corporate NAT
// gateway shares a single bucket. At the login limit they would lock each other out.
const confirmRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

module.exports = confirmRateLimiter;
