const executeQuery = require("../dbHelper");
const jwt = require("jsonwebtoken");

// Fetch all requests for recyclers
const fetchAllRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

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
  } catch (error) {
    console.error("Error in fetchAllRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Fetch accepted requests for recyclers
const fetchAcceptedRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const selectQuery = `
      SELECT ur.*, CONCAT(u.first_name, ' ', u.last_name) AS recycler_name
      FROM user_requests ur
      LEFT JOIN users u ON ur.recycler_id = u.ID
      WHERE ur.recycler_id = ? AND (ur.status = 2 OR ur.status = 5)
    `;

    const data = await executeQuery(selectQuery, [userInfo.id]);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in fetchAcceptedRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update request status (cancel request)
const updateRequestStatus = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { requestId } = req.params;
    const { status } = req.body;
    const type = "request";

    const updateQuery = `
      UPDATE user_requests 
      SET recycler_id = NULL, status = ?, type = ? 
      WHERE request_id = ?
    `;

    const result = await executeQuery(updateQuery, [status, type, requestId]);

    if (result.affectedRows === 0) {
      return res.status(404).json("Request not found");
    }

    return res.status(200).json("Request status updated successfully");
  } catch (error) {
    console.error("Error in updateRequestStatus:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// fetch recycler completed requests
const fetchCompletedRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const selectQuery = `
      SELECT ur.*, CONCAT(u.first_name, ' ', u.last_name) AS recycler_name
      FROM user_requests ur
      LEFT JOIN users u ON ur.recycler_id = u.ID
      WHERE ur.recycler_id = ? AND ur.status = 3
    `;

    const data = await executeQuery(selectQuery, [userInfo.id]);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in fetchCompletedRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  fetchAllRequests: fetchAllRequests,
  fetchAcceptedRequests: fetchAcceptedRequests,
  updateRequestStatus: updateRequestStatus,
  fetchCompletedRequests: fetchCompletedRequests,
};
