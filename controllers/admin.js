const executeQuery = require("../dbHelper");
const { ROLE } = require("../constants");
const { HttpError, asyncHandlers, toId, toInt } = require("../lib/http");
const { decideJoinRequest, setRequestStatus } = require("../lib/staff");

// All routes here: administrators only (see routes/admin.js).

// Users
const getAllUsers = async (req, res) => {
  const users = await executeQuery(
    "SELECT ID, role, first_name, last_name, email, city, address, phone, amount, active FROM users WHERE role != ?",
    [ROLE.ADMIN]
  );
  return res.json(users);
};

// Activate / deactivate a (non-admin) account
const toggleUserActivation = async (req, res) => {
  const userId = toId(req.params.userId);
  const active = toInt(req.body && req.body.active);
  if (active !== 0 && active !== 1) throw new HttpError(400, "active must be 0 or 1");

  const result = await executeQuery(
    "UPDATE users SET active = ? WHERE ID = ? AND role != ?",
    [active, userId, ROLE.ADMIN]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json("User not found");
  }

  return res.json("User activation status updated successfully");
};

// Recyclers Managers
const getAllJoinRequests = async (req, res) => {
  const statusFilter = req.query.status;
  const query = statusFilter
    ? "SELECT * FROM recyclers_manager_join_requests WHERE status = ?"
    : "SELECT * FROM recyclers_manager_join_requests";

  const data = await executeQuery(query, statusFilter ? [statusFilter] : []);
  return res.json(data);
};

// Approve / decline a recycler-manager join request. The applicant comes from the join request itself.
const updateJoinRequestStatus = async (req, res) => {
  await decideJoinRequest({
    table: "recyclers_manager_join_requests",
    joinId: req.params.joinID,
    status: req.body && req.body.status,
    newRole: ROLE.MANAGER,
    promotableRoles: [ROLE.USER, ROLE.RECYCLER, ROLE.DEMOTED],
  });
  return res.json("Join request status updated successfully");
};

// Recycle Requests
const fetchAllRequests = async (req, res) => {
  const { status } = req.query;
  const query = status
    ? "SELECT * FROM user_requests WHERE status = ?"
    : "SELECT * FROM user_requests";

  const data = await executeQuery(query, status ? [status] : []);
  return res.json(data);
};

// Search requests by user_id
const searchRequests = async (req, res) => {
  const { searchTerm } = req.query;

  let selectQuery = "SELECT * FROM user_requests";
  const queryParams = [];

  if (searchTerm) {
    selectQuery += " WHERE user_id = ?";
    queryParams.push(searchTerm);
  }

  const data = await executeQuery(selectQuery, queryParams);
  return res.json(data);
};

// Set a request's status (the panel uses it to put requests on hold / cancel them)
const updateRequestStatus = async (req, res) => {
  await setRequestStatus(req.params.requestId, req.body && req.body.status);
  return res.json("Request status updated successfully");
};

// Recycle Bins
// All recycle Bins
const fetchAllRecycleBins = async (req, res) => {
  const { type } = req.query;
  const query = type
    ? "SELECT * FROM markers WHERE type = ?"
    : "SELECT * FROM markers";

  const data = await executeQuery(query, type ? [type] : []);
  return res.json(data);
};

const setBinActive = async (binId, active) => {
  const result = await executeQuery("UPDATE markers SET active = ? WHERE id = ?", [
    active,
    toId(binId),
  ]);
  return result.affectedRows > 0;
};

// Deactivate Bin
const deactivateBin = async (req, res) => {
  if (!(await setBinActive(req.params.binId, 0))) {
    return res.status(404).json("Bin not found");
  }
  return res.json("Bin deactivated successfully");
};

// Activate Bin
const activateBin = async (req, res) => {
  if (!(await setBinActive(req.params.binId, 1))) {
    return res.status(404).json("Bin not found");
  }
  return res.json("Bin activated successfully");
};

// Get bin by id
const getBinById = async (req, res) => {
  const result = await executeQuery("SELECT * FROM markers WHERE id = ?", [
    toId(req.params.binId),
  ]);

  if (result.length === 0) {
    return res.status(404).json("Bin not found");
  }

  return res.status(200).json(result[0]);
};

// Update an existing bin
const updateBin = async (req, res) => {
  const binId = toId(req.params.binId);
  const updatedData = req.body || {};

  // Round the lat and lng values to a specific precision (e.g., 6 decimal places)
  const precision = 6;
  const roundedLat = Number(updatedData.lat).toFixed(precision);
  const roundedLng = Number(updatedData.lng).toFixed(precision);

  // Check if a bin with the same Latitude, Longitude, and type already exists
  const existingBinQuery = `
    SELECT COUNT(*) AS binCount FROM markers
    WHERE ROUND(lat, ?) = ?
    AND ROUND(lng, ?) = ?
    AND type = ?
    AND id <> ?
  `;

  const existingBinData = await executeQuery(existingBinQuery, [
    precision,
    roundedLat,
    precision,
    roundedLng,
    updatedData.type,
    binId,
  ]);

  if (existingBinData[0].binCount > 0) {
    return res
      .status(400)
      .json("A bin with this address and type already exists");
  }

  const updateQuery = `
    UPDATE markers
    SET address = ?, city = ?, lat = ?, lng = ?, type = ?, last_modified = ?
    WHERE id = ?
  `;

  const values = [
    updatedData.address || null,
    updatedData.city || null,
    roundedLat || null,
    roundedLng || null,
    updatedData.type || null,
    new Date(),
    binId,
  ];

  const result = await executeQuery(updateQuery, values);

  if (result.affectedRows === 0) {
    return res.status(404).json("Bin not found");
  }

  return res.json("Bin updated successfully");
};

// Add New Bin
const addNewBin = async (req, res) => {
  const { address, city, lat, lng, type } = req.body || {};

  // Fix precision to a specific number of decimal places (e.g., 6 decimal places)
  const precision = 6;
  const latFixed = parseFloat(lat).toFixed(precision);
  const lngFixed = parseFloat(lng).toFixed(precision);

  // Check if any bins with the same Latitude, Longitude, and type already exist
  const existingBinQuery = `
    SELECT COUNT(*) AS binCount
    FROM markers
    WHERE lat = ? AND lng = ? AND type = ?
  `;

  const existingBinData = await executeQuery(existingBinQuery, [
    latFixed,
    lngFixed,
    type,
  ]);

  if (existingBinData[0].binCount > 0) {
    return res
      .status(400)
      .json({ error: "A bin with this address and type already exists" });
  }

  const insertQuery = `
    INSERT INTO markers (address, city, lat, lng, type, active, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    address || null,
    city || null,
    latFixed || null,
    lngFixed || null,
    type || null,
    1, // Set as active
    new Date(),
  ];

  await executeQuery(insertQuery, values);

  return res.json("Bin added successfully");
};

module.exports = asyncHandlers({
  getAllUsers,
  toggleUserActivation,
  getAllJoinRequests,
  updateJoinRequestStatus,
  fetchAllRequests,
  searchRequests,
  updateRequestStatus,
  fetchAllRecycleBins,
  deactivateBin,
  activateBin,
  getBinById,
  updateBin,
  addNewBin,
});
