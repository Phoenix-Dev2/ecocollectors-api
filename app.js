// The Express app without app.listen(), so the integration tests can load it.
// server.js loads the environment, checks it and starts listening.

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const db = require("./db");
const { HttpError } = require("./lib/http");
const { notFound, errorHandler } = require("./middleware/errors");

const authRoutes = require("./routes/auth.js");
const requestsRoutes = require("./routes/requests.js");
const markersRoutes = require("./routes/markers.js");
const recyclers = require("./routes/recyclerRegister.js");
const recyclersManagers = require("./routes/recyclersManagerRegister.js");
const user = require("./routes/user.js");
const dashboardUser = require("./routes/dashboardUser.js");
const dashboardRecycler = require("./routes/dashboardRecycler.js");
const adminRoutes = require("./routes/admin.js");
const managerRoutes = require("./routes/manager.js");
const recyclerRoutes = require("./routes/recycler.js");
const welcomeAdmin = require("./routes/welcomeAdmin.js");
const welcomeRecycler = require("./routes/welcomeRecycler.js");
const welcomeManager = require("./routes/welcomeManager.js");
const welcomeUser = require("./routes/welcomeUser.js");

const app = express();
app.disable("x-powered-by");

// Behind one proxy (cloudflared on the Pi): req.ip and secure cookies use its X-Forwarded-* headers.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_PROD,
].filter(Boolean);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new HttpError(403, "The CORS policy for this site does not allow access from the specified Origin."), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.use(cors(corsOptions));

// Health check for Docker and the monitoring: 200 when the API can reach its database, else 503.
// It sits above the request logger so the frequent checks don't fill the log.
app.get("/healthz", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false });
  }
});

// Request log (method, path, origin: no bodies or personal data). Off in the tests.
if (process.env.NODE_ENV !== "test") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get("origin")}`);
    next();
  });
}

// Routes
app.use("/auth", authRoutes);
app.use("/requests", requestsRoutes);
app.use("/markers", markersRoutes);
app.use("/recyclers", recyclers);
app.use("/recyclersManagers", recyclersManagers);
app.use("/user", user);
app.use("/dashboardUser", dashboardUser);
app.use("/dashboardRecycler", dashboardRecycler);
app.use("/user/welcome", welcomeUser);
app.use("/admin", adminRoutes);
app.use("/manager", managerRoutes);
app.use("/recycler", recyclerRoutes);
app.use("/user/welcomeAdmin", welcomeAdmin);
app.use("/user/welcomeUser", welcomeUser);
app.use("/user/welcomeRecycler", welcomeRecycler);
app.use("/user/welcomeManager", welcomeManager);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
