const mongoose = require('mongoose');

// Express 4 doesn't catch rejected promises from async handlers; this forwards them to the error handler.
function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Escapes user input for use inside a RegExp or a $regex query.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { asyncHandler, isValidId, escapeRegex };
