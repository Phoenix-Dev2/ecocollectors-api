// Actions shared by the admin and manager panels.

const executeQuery = require("../dbHelper");
const { withTransaction } = require("../dbHelper");
const { JOIN_STATUS } = require("../constants");
const { HttpError, toId, toInt } = require("./http");

const JOIN_TABLES = new Set(["recyclers_join_requests", "recyclers_manager_join_requests"]);

// Approve or decline a join request. On approval the applicant (the join request's own user_id,
// not one sent by the browser) gets `newRole`, but only if their current role is one of
// `promotableRoles`: an admin can never be turned into a recycler this way.
async function decideJoinRequest({ table, joinId, status, newRole, promotableRoles }) {
  if (!JOIN_TABLES.has(table)) throw new Error(`Unknown join table ${table}`);
  const id = toId(joinId);
  const target = toInt(status);
  if (!id) throw new HttpError(404, "Join request not found");
  if (target !== JOIN_STATUS.APPROVED && target !== JOIN_STATUS.DECLINED) {
    throw new HttpError(400, "Invalid status");
  }

  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT user_id FROM ${table} WHERE join_id = ? FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) throw new HttpError(404, "Join request not found");

    if (target === JOIN_STATUS.APPROVED) {
      const [users] = await conn.query(
        "SELECT role FROM users WHERE ID = ? FOR UPDATE",
        [rows[0].user_id]
      );
      if (users.length === 0) throw new HttpError(404, "The applicant's account doesn't exist");
      const currentRole = users[0].role;
      if (currentRole !== newRole) {
        if (!promotableRoles.includes(currentRole)) {
          throw new HttpError(409, "The applicant's current role can't be changed this way");
        }
        await conn.query("UPDATE users SET role = ? WHERE ID = ?", [newRole, rows[0].user_id]);
      }
    }

    await conn.query(`UPDATE ${table} SET status = ? WHERE join_id = ?`, [target, id]);
  });
}

// user_requests.type that goes with a status set from the admin / manager panels
// (the column is NOT NULL; a cancel from these panels has always been "hold").
const TYPE_FOR_STATUS = { 1: "request", 2: "pending", 3: "completed", 4: "hold", 5: "pending" };

async function setRequestStatus(requestId, status) {
  const target = toInt(status);
  if (!Object.prototype.hasOwnProperty.call(TYPE_FOR_STATUS, target)) {
    throw new HttpError(400, "Invalid status");
  }
  const result = await executeQuery(
    "UPDATE user_requests SET status = ?, type = ? WHERE request_id = ?",
    [target, TYPE_FOR_STATUS[target], toId(requestId)]
  );
  if (result.affectedRows === 0) throw new HttpError(404, "Request not found");
}

module.exports = { decideJoinRequest, setRequestStatus };
