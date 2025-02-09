const mysql2 = require("mysql2");

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

db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection error:", err);
    process.exit(1); // Exit process if DB connection fails
  }
  console.log("Connected to MySQL Database.");
  connection.release(); // Release the connection after checking
});

module.exports = db.promise();
