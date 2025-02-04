const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "ecocollectors-ecocollectors.e.aivencloud.com",
  port: 13351,
  user: "avnadmin",
  password: "AVNS_oFUMlpjfkhwbxqAxdxu",
  database: "defaultdb",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed: ", err.message);
    return;
  }
  console.log("Connected to the database!");
});

module.exports = db;
