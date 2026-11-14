// The last two middlewares: unknown routes and errors. Clients never see SQL errors, queries
// or stack traces; the log gets a compact line without the query's parameter values.

const { HttpError } = require("../lib/http");

function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) return res.status(err.status).json(err.message);
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });

  // mysql2 errors carry the full query with its values in err.sql: log only code + message.
  const detail = err.sqlMessage ? `${err.code}: ${err.sqlMessage}` : err.stack || err;
  console.error(`${req.method} ${req.path} failed:`, detail);
  res.status(500).json({ error: "Internal Server Error" });
}

module.exports = { notFound, errorHandler };
