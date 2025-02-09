const executeQuery = require("../dbHelper");
const jwt = require("jsonwebtoken");

// Get user requests
const getUserRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");
    const userId = decoded.id;

    const q = "SELECT * FROM user_requests WHERE user_id = ?";
    const data = await executeQuery(q, [userId]);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in getUserRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update request status
const updateRequestStatus = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");
    const requestId = req.params.id;
    const { status, newBottlesNumber } = req.body;

    let type =
      status === 1 ? "request" : status === 3 ? "completed" : "pending";

    // Fetch request details
    const getRequestQuery =
      "SELECT bottles_number, user_id, recycler_id FROM user_requests WHERE request_id = ?";
    const requestData = await executeQuery(getRequestQuery, [requestId]);

    if (requestData.length === 0) {
      return res.status(404).json("Request not found");
    }

    const { bottles_number, user_id, recycler_id } = requestData[0];
    console.log("user_id:", user_id);
    console.log("bottles_number:", bottles_number);
    console.log("newBottlesNumber:", newBottlesNumber);

    let updatedRecyclerId = status === 4 || status === 1 ? null : recycler_id;

    // Update request status
    const updateQ =
      "UPDATE user_requests SET `status`=?, `type`=?, `recycler_id`=?, `completed_date`= CASE WHEN ? = 3 THEN NOW() ELSE NULL END WHERE `request_id` = ?";
    await executeQuery(updateQ, [
      status,
      type,
      updatedRecyclerId,
      status,
      requestId,
    ]);

    // Update user's amount if the status changed to 3 (completed)
    if (status === 3) {
      const updateAmountQ = "UPDATE users SET amount = amount + ? WHERE ID = ?";
      await executeQuery(updateAmountQ, [newBottlesNumber, user_id]);

      // Update bottles_number in the user_requests table
      const updateBottlesNumberQ =
        "UPDATE user_requests SET `bottles_number`=? WHERE `request_id` = ?";
      await executeQuery(updateBottlesNumberQ, [newBottlesNumber, requestId]);

      // Add bottles_number to recycler's amount
      if (updatedRecyclerId) {
        const updateRecyclerAmountQ =
          "UPDATE users SET amount = amount + ? WHERE ID = ?";
        await executeQuery(updateRecyclerAmountQ, [
          newBottlesNumber,
          updatedRecyclerId,
        ]);
      }

      // Update the completed_date to the current time
      const completedQ =
        "UPDATE user_requests SET `completed_date`= NOW() WHERE `request_id` = ?";
      await executeQuery(completedQ, [requestId]);
    }

    return res
      .status(200)
      .json({ message: "Request status updated successfully" });
  } catch (error) {
    console.error("Error in updateRequestStatus:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getUserRequests: getUserRequests,
  updateRequestStatus: updateRequestStatus,
};
