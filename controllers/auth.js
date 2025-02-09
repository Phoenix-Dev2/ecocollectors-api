const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("../nodeMailer.js");
const executeQuery = require("../dbHelper");

const register = async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await executeQuery(
      "SELECT * FROM users WHERE email = ?",
      [req.body.email]
    );

    if (existingUser.length) {
      return res.status(400).json("Email address already exists!");
    }

    // Encrypt the password and create a user
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(req.body.password, salt);
    const role = 2;
    const active = 1;

    const values = [
      role,
      req.body.first_name,
      req.body.last_name,
      req.body.email,
      hash,
      req.body.city,
      req.body.address,
      req.body.phone,
      active,
    ];

    await executeQuery(
      "INSERT INTO users(`role`,`first_name`,`last_name`,`email`,`password`,`city`,`address`,`phone`,`active`) VALUES (?)",
      [values]
    );

    return res.status(200).json("User has been created");
  } catch (error) {
    console.error("Error in register:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const login = async (req, res) => {
  try {
    // Check if user exists
    const users = await executeQuery("SELECT * FROM users WHERE email = ?", [
      req.body.email,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found!" });
    }

    const user = users[0];

    if (user.active === 0) {
      return res
        .status(401)
        .json({ error: "Account is inactive. Login is not permitted." });
    }

    // Check password
    const isPasswordCorrect = bcrypt.compareSync(
      req.body.password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Wrong username or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.ID, role: user.role }, "jwtkey", {
      expiresIn: "1d",
    });

    const { active, password, ...other } = user;

    res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        domain:
          process.env.NODE_ENV === "production"
            ? ".ecocollectors-api-production.up.railway.app"
            : undefined,
      })
      .status(200)
      .json(other);
  } catch (error) {
    console.error("Error in login:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
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

const forgotPassword = async (req, res) => {
  try {
    let newPassword = generatePassword();
    let hashedPassword = await bcrypt.hash(newPassword, 10);
    let userEmail = req.body.email;

    // Check if user exists
    const userExists = await executeQuery(
      "SELECT * FROM users WHERE email = ?",
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

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(`Failed to send email to ${userEmail}:`, error);
      } else {
        console.log(`Email sent to ${userEmail}`);
      }
      return res
        .status(200)
        .json({ message: "New password sent to your email." });
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
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

const checkActivation = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Error in checkActivation:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  register: register,
  login: login,
  logout: logout,
  forgotPassword: forgotPassword,
  checkActivation: checkActivation,
};
