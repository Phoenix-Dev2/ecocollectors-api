const executeQuery = require("../dbHelper");

const signUp = async (req, res) => {
  try {
    // Check if the email already exists in recyclers_join_requests
    const checkQuery = "SELECT * FROM recyclers_join_requests WHERE email = ?";
    const existingUser = await executeQuery(checkQuery, [req.body.email]);

    if (existingUser.length > 0) {
      return res
        .status(400)
        .json("Please be patient, we will be in contact soon!");
    }

    // Set the `status` field to 1 (open) when registering a new user
    req.body.status = 1;

    const insertQuery = `
      INSERT INTO recyclers_join_requests 
      (join_date, first_name, last_name, email, phone, message, user_id, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      req.body.join_date,
      req.body.first_name,
      req.body.last_name,
      req.body.email,
      req.body.phone,
      req.body.message,
      req.body.user_id,
      req.body.status, // Include the status field in the insert query
    ];

    await executeQuery(insertQuery, values);
    return res.status(200).json("Request has been sent");
  } catch (error) {
    console.error("Error in signUp:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  signUp: signUp,
};
