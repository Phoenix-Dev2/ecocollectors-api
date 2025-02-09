const executeQuery = require("../dbHelper");
const jwt = require("jsonwebtoken");

const getRecyclerDetails = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");

    const recyclerId = req.params.id; // Assuming recycler ID is passed as a route parameter

    const q = "SELECT first_name, last_name, phone FROM users WHERE ID = ?";
    const data = await executeQuery(q, [recyclerId]);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in getRecyclerDetails:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getRecyclerDetails: getRecyclerDetails,
};
