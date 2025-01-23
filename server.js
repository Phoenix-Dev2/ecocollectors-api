require("dotenv").config();
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

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

const port = process.env.PORT || 5432;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

// Allow cross-origin requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CLIENT_URL || "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, "src")));
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestsRoutes);
app.use("/api/markers", markersRoutes);
app.use("/api/recyclers", recyclers);
app.use("/api/recyclersManagers", recyclersManagers);
app.use("/api/user", user);
app.use("/api/dashboardUser", dashboardUser);
app.use("/api/dashboardRecycler", dashboardRecycler);
app.use("/api/user/welcome", welcomeUser);
app.use("/api/admin", adminRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/recycler", recyclerRoutes);
app.use("/api/user/welcomeAdmin", welcomeAdmin);
app.use("/api/user/welcomeUser", welcomeUser);
app.use("/api/user/welcomeRecycler", welcomeRecycler);
app.use("/api/user/welcomeManager", welcomeManager);

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
