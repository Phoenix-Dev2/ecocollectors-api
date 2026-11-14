const executeQuery = require("../dbHelper");
const { STATUS } = require("../constants");
const { HttpError, asyncHandlers, toId, toInt } = require("../lib/http");

// Fetch all requests for recyclers (route: recyclers only)
const fetchAllRequests = async (req, res) => {
  const { status } = req.query;

  let selectQuery = `
    SELECT user_requests.*,
           users.first_name AS recycler_first_name,
           users.last_name AS recycler_last_name
    FROM user_requests
    LEFT JOIN users ON user_requests.recycler_id = users.ID`;

  const queryParams = [];

  if (status) {
    selectQuery += " WHERE user_requests.status = ?";
    queryParams.push(status);
  }

  const data = await executeQuery(selectQuery, queryParams);
  return res.status(200).json(data);
};

// The recycler's claimed requests (awaiting approval or pickup)
const fetchAcceptedRequests = async (req, res) => {
  const selectQuery = `
    SELECT ur.*, CONCAT(u.first_name, ' ', u.last_name) AS recycler_name
    FROM user_requests ur
    LEFT JOIN users u ON ur.recycler_id = u.ID
    WHERE ur.recycler_id = ? AND (ur.status = ? OR ur.status = ?)
  `;

  const data = await executeQuery(selectQuery, [
    req.user.id,
    STATUS.AWAITS_APPROVAL,
    STATUS.AWAITS_PICKUP,
  ]);
  return res.status(200).json(data);
};

// The recycler gives back a request they claimed: it goes back to "awaits recycler".
const updateRequestStatus = async (req, res) => {
  const requestId = toId(req.params.requestId);
  const body = req.body || {};
  if (body.status !== undefined && toInt(body.status) !== STATUS.AWAITS_RECYCLER) {
    throw new HttpError(400, "A recycler can only give a request back (status 1)");
  }

  const result = await executeQuery(
    `UPDATE user_requests
     SET recycler_id = NULL, status = ?, type = 'request', completed_date = NULL
     WHERE request_id = ? AND recycler_id = ? AND status IN (?, ?)`,
    [
      STATUS.AWAITS_RECYCLER,
      requestId,
      req.user.id,
      STATUS.AWAITS_APPROVAL,
      STATUS.AWAITS_PICKUP,
    ]
  );

  if (result.affectedRows === 0) {
    throw new HttpError(404, "Request not found among your accepted requests");
  }

  return res.status(200).json("Request status updated successfully");
};

// The recycler's completed requests
const fetchCompletedRequests = async (req, res) => {
  const selectQuery = `
    SELECT ur.*, CONCAT(u.first_name, ' ', u.last_name) AS recycler_name
    FROM user_requests ur
    LEFT JOIN users u ON ur.recycler_id = u.ID
    WHERE ur.recycler_id = ? AND ur.status = ?
  `;

  const data = await executeQuery(selectQuery, [req.user.id, STATUS.COMPLETED]);
  return res.status(200).json(data);
};

module.exports = asyncHandlers({
  fetchAllRequests,
  fetchAcceptedRequests,
  updateRequestStatus,
  fetchCompletedRequests,
});
