const executeQuery = require("../dbHelper");
const jwt = require("jsonwebtoken");

// Utility function to get current date and time in 'YYYY-MM-DD HH:mm:ss' format with GMT+3 offset
const getCurrentDateTime = () => {
  const now = new Date();
  now.setHours(now.getHours() + 3); // Add 3 hours to account for GMT+3
  const formattedDate = now.toISOString().slice(0, 19).replace("T", " ");
  return formattedDate;
};

// Fetch requests where status is 1 or 2
const getRequests = async (req, res) => {
  try {
    const query = "SELECT * FROM user_requests WHERE status = 1 OR status = 2";
    const data = await executeQuery(query);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return res.status(500).send(error);
  }
};

// Not for recycle requests purposes - update
const getRequest = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");
    if (![1, 2, 3, 4, 5].includes(decoded.role)) {
      return res.status(403).json("Invalid user role");
    }

    const query = `SELECT request_id, user_id, full_name, req_lat, req_lng, req_address, phone_number, bottles_number, from_hour, to_hour, request_date, completed_date, status, type FROM user_requests WHERE request_id = ?`;
    const data = await executeQuery(query, [req.params.id]);

    return res.status(200).json(data[0]);
  } catch (error) {
    console.error("Error fetching request:", error);
    return res.status(500).send(error);
  }
};

// for recycle requests purposes - Collect request
const getRequestForRecycle = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");
    if (![1, 3, 4].includes(decoded.role)) {
      return res.status(403).json("Invalid user role");
    }

    const query = `SELECT request_id, user_id, full_name, req_lat, req_lng, req_address, phone_number, bottles_number, from_hour, to_hour, request_date, completed_date, status, type FROM user_requests WHERE request_id = ?`;
    const data = await executeQuery(query, [req.params.id]);

    return res.status(200).json(data[0]);
  } catch (error) {
    console.error("Error fetching request:", error);
    return res.status(500).send(error);
  }
};

// Add a new request
const addRequest = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");
    const userId = decoded.id;
    const reqStatus = 1;
    const reqType = "request";

    const query = `
      INSERT INTO user_requests (user_id, full_name, req_lat, req_lng, req_address, phone_number, bottles_number, from_hour, to_hour, request_date, status, type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      userId,
      req.body.fullName,
      req.body.reqLat,
      req.body.reqLng,
      req.body.reqAddress,
      req.body.phoneNumber,
      req.body.bottlesNumber,
      req.body.fromTime,
      req.body.toTime,
      req.body.reqDate,
      reqStatus,
      reqType,
    ];

    await executeQuery(query, values);
    return res.status(200).json("Request has been created");
  } catch (error) {
    console.error("Error adding request:", error);
    return res.status(500).send(error);
  }
};

// Delete a request
const deleteRequest = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");
    const requestId = req.params.id;

    const query =
      "DELETE FROM user_requests WHERE request_id = ? AND user_id = ?";
    const result = await executeQuery(query, [requestId, decoded.id]);

    if (result.affectedRows === 0) {
      return res.status(403).json("You can delete only your requests!");
    }

    return res.json("Request has been deleted!");
  } catch (error) {
    console.error("Error deleting request:", error);
    return res.status(500).send(error);
  }
};

// Update request type (for recyclers)
const updateRequestType = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated!");

    const decoded = jwt.verify(token, "jwtkey");
    const requestId = req.params.id;
    const type = "pending";
    const status = 2;
    const completedDate = getCurrentDateTime();

    const query = `
      UPDATE user_requests 
      SET recycler_id=?, status=?, type=?, completed_date=? 
      WHERE request_id = ?
    `;

    await executeQuery(query, [
      decoded.id,
      status,
      type,
      completedDate,
      requestId,
    ]);
    return res.json("Request has been updated.");
  } catch (error) {
    console.error("Error updating request type:", error);
    return res.status(500).send(error);
  }
};

// Update request by user
const updateRequestByUser = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated!");

    const decoded = jwt.verify(token, "jwtkey");
    const requestId = req.params.id;
    const updatedData = req.body;

    // Check if user is authorized to update
    const requestCheckQuery =
      "SELECT user_id FROM user_requests WHERE request_id = ?";
    const requestResult = await executeQuery(requestCheckQuery, [requestId]);

    if (requestResult.length === 0) {
      return res.status(404).json("Request not found");
    }

    const requestUserId = requestResult[0].user_id;
    if (decoded.role !== 1 && requestUserId !== decoded.id) {
      return res
        .status(403)
        .json("You are not authorized to update this request.");
    }

    // Build update query dynamically
    let updateQuery = "UPDATE user_requests SET ";
    const values = [];

    Object.keys(updatedData).forEach((key) => {
      if (key !== "request_id") {
        updateQuery += `${key}=?, `;
        values.push(updatedData[key]);
      }
    });

    updateQuery += "`request_date`=NOW() WHERE `request_id` = ?";
    values.push(requestId);

    await executeQuery(updateQuery, values);
    return res.json("Request has been updated by user.");
  } catch (error) {
    console.error("Error updating request by user:", error);
    return res.status(500).send(error);
  }
};

module.exports = {
  getRequests: getRequests,
  getRequestForRecycle: getRequestForRecycle,
  getRequest: getRequest,
  addRequest: addRequest,
  deleteRequest: deleteRequest,
  updateRequestType: updateRequestType,
  updateRequestByUser: updateRequestByUser,
};
