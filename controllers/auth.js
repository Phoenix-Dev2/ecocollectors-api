const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("../nodeMailer.js");
const executeQuery = require("../dbHelper");
const { ROLE } = require("../constants");
const { HttpError, asyncHandlers, normalizeEmail, escapeHtml } = require("../lib/http");

// Everything a client may see about its own account (never the password hash).
const ACCOUNT_COLUMNS = "ID, role, first_name, last_name, email, city, address, phone, amount, active";

// E-mails are stored lower-case from now on; older accounts may still have capitals, and the
// column compares case-sensitively, so look them up with LOWER(). An exact match wins if both exist.
const findByEmail = async (email, columns) =>
  executeQuery(
    `SELECT ${columns} FROM users WHERE LOWER(email) = ? ORDER BY (email = ?) DESC, ID LIMIT 1`,
    [email, email]
  );

// Compared against when the e-mail is unknown, so both cases take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const register = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || typeof password !== "string" || password.length === 0) {
    throw new HttpError(400, "E-mail and password are required");
  }

  const existingUser = await findByEmail(email, "ID");
  if (existingUser.length) {
    return res.status(400).json("Email address already exists!");
  }

  const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
  const values = [
    ROLE.USER,
    req.body.first_name,
    req.body.last_name,
    email,
    hash,
    req.body.city,
    req.body.address,
    req.body.phone,
    1, // active
  ];

  await executeQuery(
    "INSERT INTO users(`role`,`first_name`,`last_name`,`email`,`password`,`city`,`address`,`phone`,`active`) VALUES (?)",
    [values]
  );

  return res.status(200).json("User has been created");
};

const login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const wrong = { error: "Wrong email or password" };
  if (!email || typeof password !== "string") return res.status(401).json(wrong);

  const users = await findByEmail(email, `${ACCOUNT_COLUMNS}, password`);
  const user = users[0];
  const isPasswordCorrect = bcrypt.compareSync(password, user ? user.password : DUMMY_HASH);

  // Same answer for an unknown e-mail and a wrong password: no way to probe which accounts exist.
  if (!user || !isPasswordCorrect) return res.status(401).json(wrong);

  // The client shows this exact text; only after the right password, so it reveals nothing.
  if (user.active === 0) {
    return res.status(401).json({ error: "Account is inactive. Login is not permitted." });
  }

  const token = jwt.sign({ id: user.ID, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  const { active, password: _hash, ...other } = user;

  res
    .cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    })
    .status(200)
    .json({ ...other, token });
};

const logout = (req, res) => {
  res
    .clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      expires: new Date(0),
      path: "/",
    })
    .status(200)
    .json("User has been logged out");
};

// ---- Password reset by e-mailed link (S8) ----
//
// The link carries a short-lived token signed with JWT_SECRET plus the account's current password
// hash. Setting a new password changes the hash, so a link works only once, and any older links die
// with it. The secret differs from the login tokens', so neither kind works in place of the other.

const RESET_PURPOSE = "password-reset";
const RESET_MINUTES = 30;
const resetSecret = (passwordHash) => `${process.env.JWT_SECRET}.${passwordHash}`;

const FORGOT_ANSWER = {
  message:
    "If an account exists for this e-mail, we've sent it a link to choose a new password. " +
    `The link works for ${RESET_MINUTES} minutes.`,
};
const INVALID_LINK = "This reset link is invalid or has expired. Please ask for a new one.";

// The same rules as the client's register and change-password forms.
function passwordProblem(password) {
  if (typeof password !== "string") return "A new password is required";
  if (password.length < 8 || password.length > 30) return "The password must be 8 to 30 characters long";
  if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return "The password must contain at least one letter and one number";
  }
  return null;
}

// The client's reset page: the Vercel site in production, CLIENT_URL (e.g. localhost:3000) elsewhere.
function resetLink(token) {
  const base =
    process.env.NODE_ENV === "production"
      ? process.env.CLIENT_URL_PROD
      : process.env.CLIENT_URL || process.env.CLIENT_URL_PROD;
  return `${String(base).replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

function resetMail(user, link) {
  const first = user.first_name || "there";
  return {
    from: { name: "Eco Collectors", address: process.env.GMAIL_USERNAME },
    to: user.email,
    subject: "Reset your Eco Collectors password",
    text: [
      `Hello ${first},`,
      "",
      `To choose a new password, open this link within ${RESET_MINUTES} minutes:`,
      link,
      "",
      "If you didn't ask for this, ignore this e-mail: your password stays the same.",
      "",
      "The Eco Collectors Team",
    ].join("\n"),
    html: [
      '<div style="font-family: Arial, sans-serif;">',
      `<p>Hello ${escapeHtml(first)},</p>`,
      `<p>To choose a new password, open this link within ${RESET_MINUTES} minutes:</p>`,
      `<p><a href="${escapeHtml(link)}" style="font-weight: bold;">Choose a new password</a></p>`,
      `<p style="font-size: 12px; color: #555;">${escapeHtml(link)}</p>`,
      "<p>If you didn't ask for this, ignore this e-mail: your password stays the same.</p>",
      "<p>The Eco Collectors Team</p>",
      "</div>",
    ].join("\n"),
  };
}

// Always the same answer, whether or not the e-mail has an (active) account, so it can't be used to
// probe for accounts. The mail goes out in the background, so the response time doesn't tell either.
const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  if (!email) throw new HttpError(400, "Please enter your e-mail address");

  const users = await findByEmail(email, "ID, email, first_name, password, active");
  const user = users[0];
  if (user && user.active === 1) {
    const token = jwt.sign({ id: user.ID, purpose: RESET_PURPOSE }, resetSecret(user.password), {
      algorithm: "HS256",
      expiresIn: `${RESET_MINUTES}m`,
    });
    Promise.resolve()
      .then(() => transporter.sendMail(resetMail(user, resetLink(token))))
      .then(() => console.log("Password reset e-mail sent"))
      .catch((error) =>
        console.error("Failed to send the password reset e-mail:", error.code || error.message)
      );
  }
  return res.status(200).json(FORGOT_ANSWER);
};

// Sets the new password from the reset page: { token, password }.
const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(400, problem);
  if (typeof token !== "string" || token.length > 2000) throw new HttpError(400, INVALID_LINK);

  // Read the account id without trusting it yet: it only picks the hash the signature must match.
  const claimed = jwt.decode(token);
  const id = claimed && claimed.purpose === RESET_PURPOSE ? claimed.id : null;
  if (!Number.isSafeInteger(id)) throw new HttpError(400, INVALID_LINK);

  const rows = await executeQuery("SELECT ID, password, active FROM users WHERE ID = ?", [id]);
  const user = rows[0];
  if (!user || user.active !== 1) throw new HttpError(400, INVALID_LINK);

  let payload;
  try {
    payload = jwt.verify(token, resetSecret(user.password), { algorithms: ["HS256"] });
  } catch {
    throw new HttpError(400, INVALID_LINK); // expired, tampered with, or the password changed since
  }
  if (payload.purpose !== RESET_PURPOSE || payload.id !== user.ID) {
    throw new HttpError(400, INVALID_LINK);
  }

  const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
  // Only while the hash is still the one the link was signed with: no double use, even at once.
  const result = await executeQuery("UPDATE users SET password = ? WHERE ID = ? AND password = ?", [
    hash,
    user.ID,
    user.password,
  ]);
  if (result.affectedRows === 0) throw new HttpError(400, INVALID_LINK);

  return res.status(200).json("Your password has been changed. You can log in with it now.");
};

// The C-1 client asks this before forgotPassword. It used to tell anyone which e-mails have an
// account and whether it's active; now it always says yes and reads nothing. Remove it together with
// GET /auth/logout once the C-2 client is live (handoff step 3).
const checkActivation = async (req, res) => res.status(200).json({ active: true });

module.exports = asyncHandlers({
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  checkActivation,
});
