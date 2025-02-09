const executeQuery = require("../dbHelper");
const jwt = require("jsonwebtoken");

// recyclers join requests
const fetchRecyclerJoinRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const statusFilter = req.query.status;
    let selectQuery = "SELECT * FROM recyclers_join_requests";
    const queryParams = statusFilter ? [statusFilter] : [];

    if (statusFilter) {
      selectQuery += " WHERE status = ?";
    }

    const data = await executeQuery(selectQuery, queryParams);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in fetchRecyclerJoinRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Accept / Decline a join request
const updateRecyclerJoinRequestStatus = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { joinID } = req.params;
    const newStatus = req.body.status;
    console.log("Join ID:", joinID, "New Status:", newStatus);

    const updateQuery =
      "UPDATE recyclers_join_requests SET status = ? WHERE join_id = ?";
    const result = await executeQuery(updateQuery, [newStatus, joinID]);

    if (result.affectedRows === 0)
      return res.status(404).json("Join request not found");

    if (newStatus === 3) {
      const userQuery = "UPDATE users SET role = ? WHERE ID = ?";
      await executeQuery(userQuery, [3, req.body.userID]);
    }

    return res.status(200).json("Join request status updated successfully");
  } catch (error) {
    console.error("Error in updateRecyclerJoinRequestStatus:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Recyclers Management

// All regional recyclers
const getAllRecyclers = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const selectQuery =
      "SELECT ID, role, first_name, last_name, email, city, address, phone, amount, active FROM users WHERE role = 3 OR role = 5";

    const data = await executeQuery(selectQuery);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in getAllRecyclers:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Deactivate recycler and toggle between role 3 and 5
const RecyclerDeactivation = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { userId } = req.params;

    const getUserRoleQuery = "SELECT role FROM users WHERE ID = ?";
    const result = await executeQuery(getUserRoleQuery, [userId]);

    if (result.length === 0) return res.status(404).json("User not found");

    const currentRole = result[0].role;
    const newRole = currentRole === 3 ? 5 : 3;

    const updateQuery = "UPDATE users SET role = ? WHERE ID = ?";
    await executeQuery(updateQuery, [newRole, userId]);

    return res.status(200).json("User role updated successfully");
  } catch (error) {
    console.error("Error in RecyclerDeactivation:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
// Recycle Requests

// Fetch all regional requests - geo
const fetchAllRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { status } = req.query;
    let selectQuery = "SELECT * FROM user_requests";
    const queryParams = status ? [status] : [];

    if (status) {
      selectQuery += " WHERE status = ?";
    }

    const data = await executeQuery(selectQuery, queryParams);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in fetchAllRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Search requests by user_id
const searchRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { searchTerm } = req.query;
    let selectQuery = "SELECT * FROM user_requests";
    const queryParams = searchTerm ? [searchTerm] : [];

    if (searchTerm) {
      selectQuery += " WHERE user_id = ?";
    }

    const data = await executeQuery(selectQuery, queryParams);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in searchRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update the request status to 'hold'
const updateRequestStatus = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");

    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { requestId } = req.params;
    const { status } = req.body;
    const type = status === 4 ? "hold" : null;

    const updateQuery =
      "UPDATE user_requests SET status = ?, type = ? WHERE request_id = ?";
    const result = await executeQuery(updateQuery, [status, type, requestId]);

    if (result.affectedRows === 0)
      return res.status(404).json("Request not found");

    return res.status(200).json("Request status updated successfully");
  } catch (error) {
    console.error("Error in updateRequestStatus:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  fetchRecyclerJoinRequests: fetchRecyclerJoinRequests,
  updateRecyclerJoinRequestStatus: updateRecyclerJoinRequestStatus,
  getAllRecyclers: getAllRecyclers,
  RecyclerDeactivation: RecyclerDeactivation,
  fetchAllRequests: fetchAllRequests,
  searchRequests: searchRequests,
  updateRequestStatus: updateRequestStatus,
};
