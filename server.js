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

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "https://ecocollectors-client.vercel.app",
];

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

const corsOptions = {
  origin: allowedOrigins, // Allowed frontend URLs
  credentials: true, // Allow cookies to be sent
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.use(cors(corsOptions));

// Serve static files
app.use(express.static(path.join(__dirname, "src")));
app.use(express.static(path.join(__dirname, "public")));

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

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
