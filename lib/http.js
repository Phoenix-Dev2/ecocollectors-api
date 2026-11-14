// Small helpers shared by the controllers.

// An error with an HTTP status. Thrown inside a handler, the error middleware answers with
// `status` and `message` (a JSON string, like the API's other 4xx answers).
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 4 doesn't catch rejected promises: wrap async handlers so errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Wraps every handler of a controller module.
const asyncHandlers = (handlers) =>
  Object.fromEntries(
    Object.entries(handlers).map(([name, fn]) => [name, asyncHandler(fn)])
  );

// A positive integer id from a route param or body value, else null.
const toId = (value) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

// An integer from a JSON number or numeric string, else null.
const toInt = (value) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isSafeInteger(n) ? n : null;
};

// E-mail addresses are compared and stored lower-case (the column collation is case-sensitive).
const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

module.exports = {
  HttpError,
  asyncHandler,
  asyncHandlers,
  toId,
  toInt,
  normalizeEmail,
  escapeHtml,
};
