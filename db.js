const mysql2 = require("mysql2");
const fs = require("fs");

const db = mysql2.createPool({
  host: "phoenixdev.helioho.st",
  port: 3306,
  user: "phoenixdev_admin",
  password: "uWK@hr8Xnm6tyau",
  database: "phoenixdev_ecocollectors",
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Check database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection error:", err);
    process.exit(1); // Exit process if DB connection fails
  }
  console.log("Connected to MySQL Database.");
  connection.release(); // Release the connection after checking
});

// Function to log queries
const logQuery = (query, params) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] SQL Query: ${query} | Params: ${JSON.stringify(
    params
  )}\n`;

  console.log(logMessage); // Log to console

  // Append to log file
  fs.appendFile("db_logs.txt", logMessage, (err) => {
    if (err) console.error("Failed to write log:", err);
  });
};

// Override the db.query function to log all queries
const originalQuery = db.query;
db.query = function (sql, params, callback) {
  logQuery(sql, params); // Log the query
  return originalQuery.call(db, sql, params, callback);
};

// Override the promise-based query method as well
const dbPromise = db.promise();
const originalExecute = dbPromise.execute;
dbPromise.execute = function (sql, params) {
  logQuery(sql, params); // Log the query
  return originalExecute.call(dbPromise, sql, params);
};

module.exports = dbPromise;
