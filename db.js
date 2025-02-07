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

module.exports = db.promise();
