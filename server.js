require("dotenv").config();

// Login tokens are signed and checked with JWT_SECRET (Render env / the Pi's env file / .env locally).
// Refuse to start without a long one: a weak or shared secret lets anyone forge an admin login.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET is missing or shorter than 32 characters. Set a long random value, e.g. the output of: openssl rand -hex 32");
  process.exit(1);
}

const app = require("./app");

const port = process.env.PORT || 5432;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
