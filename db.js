const mysql2 = require("mysql2");
const fs = require("fs");

const db = mysql2.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  // TLS stays on by default (HelioHost/TiDB). DB_SSL=false turns it off for a database on the same
  // private Docker network (the Raspberry Pi setup), where the connection never leaves the machine.
  ssl:
    process.env.DB_SSL === "false"
      ? undefined
      : {
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

// Query logging is for local development only. In production it would write every query WITH its
// parameters (e-mails, etc.) to the console and to db_logs.txt, a file that grows forever.
const LOG_QUERIES = process.env.NODE_ENV === "development";

// Override the db.query function to log all queries
if (LOG_QUERIES) {
  const originalQuery = db.query;
  db.query = function (sql, params, callback) {
    logQuery(sql, params); // Log the query
    return originalQuery.call(db, sql, params, callback);
  };
}

// Override the promise-based query method as well
const dbPromise = db.promise();
if (LOG_QUERIES) {
  const originalExecute = dbPromise.execute;
  dbPromise.execute = function (sql, params) {
    logQuery(sql, params); // Log the query
    return originalExecute.call(dbPromise, sql, params);
  };
}

module.exports = dbPromise;
