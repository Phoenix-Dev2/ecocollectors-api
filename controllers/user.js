const bcrypt = require("bcryptjs");
const transporter = require("../nodeMailer.js");
const executeQuery = require("../dbHelper");
const { HttpError, asyncHandlers, normalizeEmail, escapeHtml } = require("../lib/http");

// Everything a client may see about its own account (never the password hash).
const ACCOUNT_COLUMNS = "ID, role, first_name, last_name, email, city, address, phone, amount, active";

// Update the logged-in user's details. Fields left out (or empty) keep their current value.
const updateUser = async (req, res) => {
  const body = req.body || {};
  const email = normalizeEmail(body.email) || null;

  if (email) {
    const existingUsers = await executeQuery(
      "SELECT ID FROM users WHERE LOWER(email) = ? AND ID != ?",
      [email, req.user.id]
    );
    if (existingUsers.length) {
      return res.status(400).json("Email address already exists!");
    }
  }

  const updateQuery = `
    UPDATE users
    SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
        email = COALESCE(?, email), city = COALESCE(?, city),
        address = COALESCE(?, address), phone = COALESCE(?, phone)
    WHERE ID = ?
  `;

  const values = [
    body.first_name || null,
    body.last_name || null,
    email,
    body.city || null,
    body.address || null,
    body.phone || null,
    req.user.id,
  ];

  const result = await executeQuery(updateQuery, values);
  if (result.affectedRows > 0) return res.json("Updated");

  return res.status(403).json("You can update only your account");
};

// Change the logged-in user's password
const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body || {};
  if (typeof old_password !== "string" || typeof new_password !== "string" || !new_password) {
    throw new HttpError(400, "Old and new password are required");
  }

  const userData = await executeQuery("SELECT password FROM users WHERE ID = ?", [req.user.id]);
  if (userData.length === 0) return res.status(404).json("User not found!");

  const isPasswordCorrect = bcrypt.compareSync(old_password, userData[0].password);
  if (!isPasswordCorrect) return res.status(400).json("Invalid old password");

  const hashedPassword = bcrypt.hashSync(new_password, bcrypt.genSaltSync(10));
  const result = await executeQuery("UPDATE users SET password = ? WHERE ID = ?", [
    hashedPassword,
    req.user.id,
  ]);

  if (result.affectedRows > 0) return res.json("Password changed successfully!");

  return res.status(500).json("Failed to change password");
};

// The logged-in user's account details
const getUserInfo = async (req, res) => {
  const data = await executeQuery(`SELECT ${ACCOUNT_COLUMNS} FROM users WHERE ID = ?`, [req.user.id]);
  if (data.length === 0) return res.status(404).json("User not found!");
  return res.json(data[0]);
};

// The logged-in user's current role (from the database, not the token)
const getUserRole = async (req, res) => {
  return res.status(200).json({ role: req.user.role });
};

// Deactivate the logged-in user's account
const deactivateAccount = async (req, res) => {
  const result = await executeQuery("UPDATE users SET active = 0 WHERE ID = ?", [req.user.id]);
  if (result.affectedRows > 0) return res.json("Account deactivated successfully");
  return res.status(500).json("Failed to deactivate account");
};

const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

// Contact Us (public, rate-limited): mails the message to CONTACT_US_MAIL.
const sendEmail = async (req, res) => {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const subject = typeof body.subject === "string" ? body.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ message: "Please enter a valid e-mail address." });
  }
  if (!subject || subject.length > 150) {
    return res.status(400).json({ message: "The subject must be 1-150 characters." });
  }
  if (!message || message.length > 5000) {
    return res.status(400).json({ message: "The message must be 1-5000 characters." });
  }

  const mailOptions = {
    from: { name: "Eco Collectors", address: process.env.GMAIL_USERNAME },
    to: process.env.CONTACT_US_MAIL, // Send all emails to this address
    replyTo: email,
    subject: `Contact form: ${subject}`,
    text: `From: ${email}\nSubject: ${subject}\n\n${message}`,
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>New Contact Form Submission</h2>
        <p><strong>Sender's Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send the contact e-mail:", error.code || error.message);
    return res.status(500).json({ message: "Failed to send email." });
  }
  return res.status(200).json({ message: "Email sent successfully." });
};

module.exports = asyncHandlers({
  updateUser,
  changePassword,
  getUserInfo,
  getUserRole,
  deactivateAccount,
  sendEmail,
});
