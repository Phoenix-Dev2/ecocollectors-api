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

db.connect((err) => {
  if (err) {
    console.error("Database connection failed: ", err.message);
    return;
  }
  console.log("Connected to the database!");
});

module.exports = db.promise();
