const executeQuery = require("../dbHelper");
const { ROLE } = require("../constants");
const { HttpError, asyncHandlers, toId } = require("../lib/http");
const { decideJoinRequest, setRequestStatus } = require("../lib/staff");

// All routes here: recycler managers only (see routes/manager.js).

// recyclers join requests
const fetchRecyclerJoinRequests = async (req, res) => {
  const statusFilter = req.query.status;
  let selectQuery = "SELECT * FROM recyclers_join_requests";
  const queryParams = statusFilter ? [statusFilter] : [];

  if (statusFilter) {
    selectQuery += " WHERE status = ?";
  }

  const data = await executeQuery(selectQuery, queryParams);
  return res.status(200).json(data);
};

// Accept / Decline a recycler join request. The applicant comes from the join request itself.
const updateRecyclerJoinRequestStatus = async (req, res) => {
  await decideJoinRequest({
    table: "recyclers_join_requests",
    joinId: req.params.joinID,
    status: req.body && req.body.status,
    newRole: ROLE.RECYCLER,
    promotableRoles: [ROLE.USER, ROLE.DEMOTED],
  });
  return res.status(200).json("Join request status updated successfully");
};

// All regional recyclers
const getAllRecyclers = async (req, res) => {
  const data = await executeQuery(
    "SELECT ID, role, first_name, last_name, email, city, address, phone, amount, active FROM users WHERE role = ? OR role = ?",
    [ROLE.RECYCLER, ROLE.DEMOTED]
  );
  return res.status(200).json(data);
};

// Deactivate / reactivate a recycler: toggles role 3 <-> 5. Other accounts are off limits.
const RecyclerDeactivation = async (req, res) => {
  const userId = toId(req.params.userId);
  const result = await executeQuery("SELECT role FROM users WHERE ID = ?", [userId]);
  if (result.length === 0) throw new HttpError(404, "User not found");

  const currentRole = result[0].role;
  if (currentRole !== ROLE.RECYCLER && currentRole !== ROLE.DEMOTED) {
    throw new HttpError(403, "Only recyclers can be activated or deactivated here");
  }
  const newRole = currentRole === ROLE.RECYCLER ? ROLE.DEMOTED : ROLE.RECYCLER;

  await executeQuery("UPDATE users SET role = ? WHERE ID = ? AND role = ?", [
    newRole,
    userId,
    currentRole,
  ]);
  return res.status(200).json("User role updated successfully");
};

// Fetch all regional requests - geo
const fetchAllRequests = async (req, res) => {
  const { status } = req.query;
  let selectQuery = "SELECT * FROM user_requests";
  const queryParams = status ? [status] : [];

  if (status) {
    selectQuery += " WHERE status = ?";
  }

  const data = await executeQuery(selectQuery, queryParams);
  return res.status(200).json(data);
};

// Search requests by user_id
const searchRequests = async (req, res) => {
  const { searchTerm } = req.query;
  let selectQuery = "SELECT * FROM user_requests";
  const queryParams = searchTerm ? [searchTerm] : [];

  if (searchTerm) {
    selectQuery += " WHERE user_id = ?";
  }

  const data = await executeQuery(selectQuery, queryParams);
  return res.status(200).json(data);
};

// Set a request's status (the panel uses it to put requests on hold / cancel them)
const updateRequestStatus = async (req, res) => {
  await setRequestStatus(req.params.requestId, req.body && req.body.status);
  return res.status(200).json("Request status updated successfully");
};

module.exports = asyncHandlers({
  fetchRecyclerJoinRequests,
  updateRecyclerJoinRequestStatus,
  getAllRecyclers,
  RecyclerDeactivation,
  fetchAllRequests,
  searchRequests,
  updateRequestStatus,
});
