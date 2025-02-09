const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("../nodeMailer.js");
const executeQuery = require("../dbHelper");

// Update user details
const updateUser = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    // Check if email already exists for another user
    const emailCheckQuery = "SELECT * FROM users WHERE email = ? AND ID != ?";
    const existingUsers = await executeQuery(emailCheckQuery, [
      req.body.email,
      userInfo.id,
    ]);

    if (existingUsers.length) {
      return res.status(400).json("Email address already exists!");
    }

    const updateQuery = `
      UPDATE users 
      SET first_name = ?, last_name = ?, email = ?, city = ?, address = ?, phone = ? 
      WHERE ID = ?
    `;

    const values = [
      req.body.first_name || userInfo.first_name,
      req.body.last_name || userInfo.last_name,
      req.body.email || userInfo.email,
      req.body.city || userInfo.city,
      req.body.address || userInfo.address,
      req.body.phone || userInfo.phone,
      userInfo.id,
    ];

    const result = await executeQuery(updateQuery, values);
    if (result.affectedRows > 0) return res.json("Updated");

    return res.status(403).json("You can update only your account");
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json(error);
  }
};

// Change user password
const changePassword = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decodedToken = jwt.verify(token, "jwtkey");
    const { old_password, new_password } = req.body;
    const userId = decodedToken.id;

    // Fetch user data
    const userQuery = "SELECT * FROM users WHERE ID = ?";
    const userData = await executeQuery(userQuery, [userId]);

    if (userData.length === 0) return res.status(404).json("User not found!");

    // Validate old password
    const isPasswordCorrect = bcrypt.compareSync(
      old_password,
      userData[0].password
    );
    if (!isPasswordCorrect) return res.status(400).json("Invalid old password");

    // Hash the new password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(new_password, salt);

    // Update password
    const updatePasswordQuery = "UPDATE users SET password = ? WHERE ID = ?";
    const result = await executeQuery(updatePasswordQuery, [
      hashedPassword,
      userId,
    ]);

    if (result.affectedRows > 0)
      return res.json("Password changed successfully!");

    return res.status(500).json("Failed to change password");
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json(error);
  }
};

// Get user information
const getUserInfo = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decodedToken = jwt.verify(token, "jwtkey");
    const userId = decodedToken.id;

    const query = "SELECT * FROM users WHERE ID = ?";
    const data = await executeQuery(query, [userId]);

    if (data.length === 0) return res.status(404).json("User not found!");

    return res.json(data[0]);
  } catch (error) {
    console.error("Error fetching user info:", error);
    return res.status(500).json(error);
  }
};

// Get user role
const getUserRole = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: "No token found" });

    const decodedToken = jwt.verify(token, "jwtkey");
    return res.status(200).json({ role: decodedToken.role });
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(500).json({ message: "Invalid token" });
  }
};

// Deactivate user account
const deactivateAccount = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decodedToken = jwt.verify(token, "jwtkey");
    const userId = decodedToken.id;

    const updateQuery = "UPDATE users SET active = 0 WHERE ID = ?";
    const result = await executeQuery(updateQuery, [userId]);

    if (result.affectedRows > 0)
      return res.json("Account deactivated successfully");

    return res.status(500).json("Failed to deactivate account");
  } catch (error) {
    console.error("Error deactivating account:", error);
    return res.status(500).json(error);
  }
};

// Contact Us - Send Email
const sendEmail = async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    const mailOptions = {
      from: "Eco Collectors <your-email@example.com>",
      to: process.env.CONTACT_US_MAIL, // Send all emails to this address
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>New Contact Form Submission</h2>
          <p><strong>Sender's Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        </div>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Failed to send email:", error);
        return res.status(500).json({ message: "Failed to send email." });
      } else {
        console.log("Email sent:", info.response);
        return res.status(200).json({ message: "Email sent successfully." });
      }
    });
  } catch (error) {
    console.error("Error in sendEmail:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
};

module.exports = {
  updateUser: updateUser,
  changePassword: changePassword,
  getUserInfo: getUserInfo,
  getUserRole: getUserRole,
  deactivateAccount: deactivateAccount,
  sendEmail: sendEmail,
};
