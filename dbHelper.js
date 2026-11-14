const db = require("./db");

// Runs one query on the pool and returns the rows (or the OkPacket for writes).
// Errors are left to the caller / the error middleware, which logs them without the query values.
const executeQuery = async (query, params = []) => {
  const [results] = await db.query(query, params);
  return results;
};

// Runs `work(conn)` inside a transaction on one connection: commit if it resolves,
// roll back if it throws. Use conn.query(...) inside; it returns [rows, fields].
const withTransaction = async (work) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // the original error matters more
    }
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = executeQuery;
module.exports.withTransaction = withTransaction;
