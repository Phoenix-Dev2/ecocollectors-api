// "Join as recycler" and "join as recycler manager" forms: same fields, different tables.

const executeQuery = require("../dbHelper");
const { JOIN_STATUS } = require("../constants");
const { HttpError, toId } = require("./http");

const TABLES = new Set(["recyclers_join_requests", "recyclers_manager_join_requests"]);

async function createJoinRequest(table, req) {
  if (!TABLES.has(table)) throw new Error(`Unknown join table ${table}`);
  const body = req.body || {};

  // A logged-in caller always applies for themselves. The current client doesn't send its
  // token on this call yet, so it falls back to the user_id in the form (approval then checks
  // the applicant's role, see lib/staff.js).
  const userId = req.user ? req.user.id : toId(body.user_id);
  if (!userId) throw new HttpError(400, "Please log in before applying");

  const existing = await executeQuery(`SELECT join_id FROM ${table} WHERE email = ?`, [body.email]);
  if (existing.length > 0) {
    throw new HttpError(400, "Please be patient, we will be in contact soon!");
  }

  await executeQuery(
    `INSERT INTO ${table} (join_date, first_name, last_name, email, phone, message, user_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.join_date,
      body.first_name,
      body.last_name,
      body.email,
      body.phone,
      body.message,
      userId,
      JOIN_STATUS.OPEN,
    ]
  );
}

module.exports = { createJoinRequest };
