const executeQuery = require("../dbHelper");

const getActiveMarkers = async (req, res) => {
  try {
    const q = req.query.type
      ? "SELECT * FROM markers WHERE type=? AND active=1"
      : "SELECT * FROM markers WHERE active=1";

    const markers = await executeQuery(
      q,
      req.query.type ? [req.query.type] : []
    );

    return res.status(200).json(markers);
  } catch (error) {
    console.error("Error fetching active markers:", error);
    return res.status(500).json({ error: "Failed to fetch active markers" });
  }
};

module.exports = { getActiveMarkers };
