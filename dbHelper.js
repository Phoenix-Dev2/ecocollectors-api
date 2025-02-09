const db = require("./db");

const executeQuery = async (query, params = []) => {
  try {
    const [results] = await db.query(query, params);
    return results;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};

module.exports = executeQuery;
