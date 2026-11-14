const executeQuery = require("../dbHelper");
const { asyncHandlers } = require("../lib/http");

// Active recycle bins for the public map, optionally of one type
const getActiveMarkers = async (req, res) => {
  const q = req.query.type
    ? "SELECT * FROM markers WHERE type=? AND active=1"
    : "SELECT * FROM markers WHERE active=1";

  const markers = await executeQuery(q, req.query.type ? [req.query.type] : []);
  return res.status(200).json(markers);
};

module.exports = asyncHandlers({ getActiveMarkers });
