const bcrypt = require("bcryptjs");
const { db } = require("../db.js");
const jwt = require("jsonwebtoken");
const transporter = require("../nodeMailer.js");

const register = (req, res) => {
  // Check Existing user
  const q = "SELECT * FROM users WHERE email = ?";

  db.query(q, [req.body.email], (err, data) => {
    console.log(req.body.email);
    if (err) return res.json(err);
    if (data.length) {
      return res.status(400).json("Email address already exists!");
    }

    // Encrypt the password and create a user
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(req.body.password, salt);
    const role = 2;
    const active = 1;
    const q =
      "INSERT INTO users(`role`,`first_name`,`last_name`,`email`,`password`,`city`,`address`,`phone`,`active`) VALUES (?)";
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
    console.log(values);
    db.query(q, [values], (err, data) => {
      if (err) return res.json(err);
      return res.status(200).json("User has been created");
    });
  });
};

const login = (req, res) => {
  // Check User existence in db
  const q = "SELECT * FROM users WHERE email = ?";
  db.query(q, [req.body.email], (err, data) => {
    if (err) {
      console.error("Error in login:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: "User not found!" });
    }

    if (data[0].active === 0) {
      return res
        .status(401)
        .json({ error: "Account is inactive. Login is not permitted." });
    }

    // Check password
    const isPasswordCorrect = bcrypt.compareSync(
      req.body.password,
      data[0].password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Wrong username or password" });
    }

    // Using the user unique id to create a token
    const token = jwt.sign({ id: data[0].ID, role: data[0].role }, "jwtkey", {
      expiresIn: "1d",
    });

    // removing the password from the data object so it will not be sent
    const { active, password, ...other } = data[0];

    // sending the user a secure cookie via the cookie-parser
    res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // ✅ True in production (Render uses HTTPS)
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // ✅ "None" allows cross-site cookies in production
        domain:
          process.env.NODE_ENV === "production"
            ? ".https://ecocollectors-api-production.up.railway.app"
            : undefined, // ✅ Optional for subdomains
      })
      .status(200)
      .json(other);
  });
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
    // Generate new password
    let newPassword = generatePassword();
    // Hash password
    let hashedPassword = await bcrypt.hash(newPassword, 10);
    let userEmail = req.body.email;

    // Check if user exists
    const userExistsQuery = "SELECT * FROM users WHERE email = ?";
    db.query(userExistsQuery, [userEmail], async (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (result.length === 0) {
        return res.status(400).json({ error: "User does not exist." });
      }

      // Update user password in the database
      const updateUserPasswordQuery =
        "UPDATE users SET password = ? WHERE email = ?";
      db.query(
        updateUserPasswordQuery,
        [hashedPassword, userEmail],
        async (err, result) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          // Send email with the new password to the user
          let mailOptions = {
            from: "Eco Collectors",
            to: userEmail,
            subject: "Password Reset Request",
            html: `
            <div style="font-family: Arial, sans-serif;">
              <h1>Hello ${userEmail},</h1>
              <p>We have received a request to reset your password for your Eco Collectors account.</p>
              <p>Your new password is:</p>
              <p style="font-weight: bold; font-size: 18px;">${newPassword}</p>
              <p>Please ensure to change your password immediately after logging in for security purposes.</p>
              <p>If you did not request a password reset, please ignore this email or contact our support team.</p>
              <br>
              <p>Best regards,</p>
              <p>The Eco Collectors Team</p>
            </div>
          `,
          };

          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.error(`Failed to send email to ${userEmail}:`, error);
            } else {
              console.log(`Email sent to ${userEmail}`);
            }
            return res
              .status(200)
              .json({ message: "New password sent to your email." });
          });
        }
      );
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

    // Check if the account with the provided email is active (not deactivated)
    const selectQuery = "SELECT active FROM users WHERE email = ?";
    db.query(selectQuery, [email], (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (result.length === 0) {
        return res.status(400).json({ error: "User does not exist." });
      }

      const isActive = result[0].active === 1; // Check if 'active' field is 1
      res.status(200).json({ active: isActive });
    });
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
