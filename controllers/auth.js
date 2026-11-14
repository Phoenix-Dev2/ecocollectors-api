const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("../nodeMailer.js");
const executeQuery = require("../dbHelper");
const { ROLE } = require("../constants");
const { HttpError, asyncHandlers, normalizeEmail } = require("../lib/http");

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

// To be replaced by a reset-link flow (PR S-2). Until then only rate-limited.
const forgotPassword = async (req, res) => {
  let newPassword = generatePassword();
  let hashedPassword = await bcrypt.hash(newPassword, 10);
  let userEmail = req.body.email;

  // Check if user exists
  const userExists = await executeQuery(
    "SELECT ID FROM users WHERE email = ?",
    [userEmail]
  );

  if (userExists.length === 0) {
    return res.status(400).json({ error: "User does not exist." });
  }

  // Update password
  await executeQuery("UPDATE users SET password = ? WHERE email = ?", [
    hashedPassword,
    userEmail,
  ]);

  let mailOptions = {
    from: "Eco Collectors",
    to: userEmail,
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h1>Hello ${userEmail},</h1>
        <p>Your new password is:</p>
        <p style="font-weight: bold; font-size: 18px;">${newPassword}</p>
        <p>Please change your password after logging in.</p>
        <br>
        <p>Best regards,</p>
        <p>The Eco Collectors Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Password reset e-mail sent");
  } catch (error) {
    console.error("Failed to send the password reset e-mail:", error.code || error.message);
  }
  return res.status(200).json({ message: "New password sent to your email." });
};

function generatePassword() {
  const length = 12;
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]\\:;?><,./-=";
  let password = "";
  for (let i = 0; i < length; ++i) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Part of the forgot-password page; reworked with it in PR S-2.
const checkActivation = async (req, res) => {
  const { email } = req.query;

  const result = await executeQuery(
    "SELECT active FROM users WHERE email = ?",
    [email]
  );

  if (result.length === 0) {
    return res.status(400).json({ error: "User does not exist." });
  }

  const isActive = result[0].active === 1;
  res.status(200).json({ active: isActive });
};

module.exports = asyncHandlers({
  register,
  login,
  logout,
  forgotPassword,
  checkActivation,
});
