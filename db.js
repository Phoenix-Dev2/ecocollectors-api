const mysql = require("mysql");

const db = mysql.createConnection({
  host: "sql8.freesqldatabase.com",
  user: "sql8759256",
  password: "GtlNAcLvdy",
  database: "sql8759256",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed: ", err.message);
    return;
  }
  console.log("Connected to the database!");
});

module.exports = {
  db: db,
};
