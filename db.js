const mysql2 = require("mysql2");

const db = mysql2.createConnection({
  host: "ecocollectors-ecocollectors.e.aivencloud.com",
  port: 13351,
  user: "avnadmin",
  password: "AVNS_oFUMlpjfkhwbxqAxdxu",
  database: "defaultdb",
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

module.exports = { db };
