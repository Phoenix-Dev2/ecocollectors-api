// Authentication for every protected route (replaces the copy in each controller).
//
// The login token is read from `Authorization: Bearer <token>` first and, while the client still
// relies on it, from the `access_token` cookie. The user's role and `active` flag are then read
// from the database on every request, so a deactivated or demoted user loses access at once
// instead of keeping it until the 24 h token expires.

const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

const MESSAGES = {
  missing: "Not authenticated",
  invalid: "Invalid or expired token",
  inactive: "Account is inactive",
};

function tokenCandidates(req) {
  const tokens = [];
  const header = req.get("authorization");
  const match = header && /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (match && match[1] !== "null" && match[1] !== "undefined") tokens.push(match[1]);
  const cookie = req.cookies && req.cookies.access_token;
  if (cookie && !tokens.includes(cookie)) tokens.push(cookie);
  return tokens;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null; // expired, bad signature or malformed
  }
}

// -> { user: { id, role } } or { user: null, reason }
async function authenticate(req) {
  const candidates = tokenCandidates(req);
  if (candidates.length === 0) return { user: null, reason: "missing" };

  for (const token of candidates) {
    const payload = verifyToken(token);
    if (!payload || !Number.isSafeInteger(payload.id)) continue;

    const rows = await executeQuery(
      "SELECT ID, role, active FROM users WHERE ID = ?",
      [payload.id]
    );
    if (rows.length === 0) return { user: null, reason: "invalid" };
    if (rows[0].active !== 1) return { user: null, reason: "inactive" };
    return { user: { id: rows[0].ID, role: rows[0].role } };
  }
  return { user: null, reason: "invalid" };
}

// 401 unless the request carries a valid token of an active user. Sets req.user = { id, role }.
async function requireAuth(req, res, next) {
  try {
    const { user, reason } = await authenticate(req);
    if (!user) return res.status(401).json(MESSAGES[reason]);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Like requireAuth, but anonymous requests go through with req.user = null.
async function optionalAuth(req, res, next) {
  try {
    const { user } = await authenticate(req);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Use after requireAuth: 403 unless the user has one of the roles.
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json(MESSAGES.missing);
    if (!roles.includes(req.user.role)) {
      return res.status(403).json("You are not authorized to access this resource");
    }
    next();
  };

module.exports = { requireAuth, optionalAuth, requireRole };
