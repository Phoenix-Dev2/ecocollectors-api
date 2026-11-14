// Integration-test helpers. The tests run the real app against a throw-away MariaDB in Docker
// (`npm run test:db:start`), never against a real database: this file refuses anything but a
// local database whose name ends in _test, and the app is loaded without the .env file.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const TEST_DB = {
  host: process.env.TEST_DB_HOST || "127.0.0.1",
  port: Number(process.env.TEST_DB_PORT || 3307),
  user: process.env.TEST_DB_USER || "root",
  password: process.env.TEST_DB_PASS || "eco-test",
  database: process.env.TEST_DB_NAME || "eco_test",
};

if (!["127.0.0.1", "localhost", "::1"].includes(TEST_DB.host) || !/_test$/.test(TEST_DB.database)) {
  throw new Error("The tests only run against a local database whose name ends in _test.");
}

const JWT_SECRET = crypto.randomBytes(32).toString("hex");

Object.assign(process.env, {
  NODE_ENV: "test",
  DB_HOST: TEST_DB.host,
  DB_PORT: String(TEST_DB.port),
  DB_USER: TEST_DB.user,
  DB_PASS: TEST_DB.password,
  DB_NAME: TEST_DB.database,
  DB_SSL: "false",
  JWT_SECRET,
  RATE_LIMIT: "off",
  CLIENT_URL: "http://client.example.test",
  CLIENT_URL_PROD: "https://client-prod.example.test",
  CONTACT_US_MAIL: "contact@example.test",
  GMAIL_USERNAME: "noreply@example.test",
  GMAIL_PASSWORD: "unused",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectAdmin() {
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      return await mysql.createConnection({
        host: TEST_DB.host,
        port: TEST_DB.port,
        user: TEST_DB.user,
        password: TEST_DB.password,
        multipleStatements: true,
      });
    } catch (err) {
      if (Date.now() > deadline) {
        throw new Error(
          `No test database at ${TEST_DB.host}:${TEST_DB.port} (${err.code}). Start it with: npm run test:db:start`
        );
      }
      await sleep(1000);
    }
  }
}

// Fresh database from test/schema.sql, then the app (which connects when it's loaded).
async function startApp() {
  const conn = await connectAdmin();
  await conn.query(
    `DROP DATABASE IF EXISTS \`${TEST_DB.database}\`;
     CREATE DATABASE \`${TEST_DB.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
     USE \`${TEST_DB.database}\`;`
  );
  await conn.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  await conn.end();

  // Never send real e-mail: record it instead.
  const transporter = require("../nodeMailer");
  const sentMail = [];
  transporter.sendMail = (options, callback) => {
    sentMail.push(options);
    const info = { response: "250 stubbed" };
    if (typeof callback === "function") return void callback(null, info);
    return Promise.resolve(info);
  };

  const app = require("../app");
  const db = require("../db");
  const request = require("supertest");
  return { app, db, api: () => request(app), sentMail };
}

async function stopApp() {
  await require("../db").end();
}

const PASSWORD = "Secret-pass-1";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
let counter = 0;

async function createUser(db, { role = 2, active = 1, email, first_name = "Test", phone = "0500000000" } = {}) {
  counter += 1;
  const mail = email || `user${counter}-${Date.now()}@example.test`;
  const [result] = await db.query(
    "INSERT INTO users (role, first_name, last_name, email, password, city, address, phone, amount, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
    [role, first_name, `User${counter}`, mail, PASSWORD_HASH, "Haifa", "Herzl 1", phone, active]
  );
  return { id: result.insertId, role, email: mail };
}

async function createRequest(db, { user_id, status = 1, recycler_id = null, bottles_number = 10, full_name = "Owner Name", phone_number = "0521234567", type = "request" }) {
  const [result] = await db.query(
    `INSERT INTO user_requests (user_id, full_name, req_lat, req_lng, req_address, phone_number, bottles_number, from_hour, to_hour, recycler_id, request_date, status, type)
     VALUES (?, ?, 32.79, 34.98, 'Herzl 1, Haifa', ?, ?, '08:00', '12:00', ?, NOW(), ?, ?)`,
    [user_id, full_name, phone_number, bottles_number, recycler_id, status, type]
  );
  return result.insertId;
}

async function getRequestRow(db, requestId) {
  const [rows] = await db.query("SELECT * FROM user_requests WHERE request_id = ?", [requestId]);
  return rows[0];
}

async function getUserRow(db, userId) {
  const [rows] = await db.query("SELECT * FROM users WHERE ID = ?", [userId]);
  return rows[0];
}

// A login token like the API issues, for a user from createUser.
const tokenFor = (user, { expiresIn = "1h", secret = JWT_SECRET, role = user.role } = {}) =>
  jwt.sign({ id: user.id, role }, secret, { expiresIn });

const bearer = (user, options) => ({ Authorization: `Bearer ${tokenFor(user, options)}` });

module.exports = {
  startApp,
  stopApp,
  createUser,
  createRequest,
  getRequestRow,
  getUserRow,
  tokenFor,
  bearer,
  PASSWORD,
};
