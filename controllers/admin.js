const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

// Users
const getAllUsers = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const users = await executeQuery(
      "SELECT ID, role, first_name, last_name, email, city, address, phone, amount, active FROM users WHERE role != 1"
    );

    return res.json(users);
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const toggleUserActivation = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { userId } = req.params;
    const { active } = req.body;

    const result = await executeQuery(
      "UPDATE users SET active = ? WHERE ID = ?",
      [active, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json("User not found");
    }

    return res.json("User activation status updated successfully");
  } catch (error) {
    console.error("Error in toggleUserActivation:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Recyclers Managers
const getAllJoinRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const statusFilter = req.query.status;
    const query = statusFilter
      ? "SELECT * FROM recyclers_manager_join_requests WHERE status = ?"
      : "SELECT * FROM recyclers_manager_join_requests";

    const data = await executeQuery(query, statusFilter ? [statusFilter] : []);

    return res.json(data);
  } catch (error) {
    console.error("Error in getAllJoinRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateJoinRequestStatus = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { joinID } = req.params;
    const newStatus = req.body.status;

    const result = await executeQuery(
      "UPDATE recyclers_manager_join_requests SET status = ? WHERE join_id = ?",
      [newStatus, joinID]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json("Join request not found");
    }

    if (newStatus === 3) {
      await executeQuery("UPDATE users SET role = ? WHERE ID = ?", [
        4,
        req.body.userID,
      ]);
    }

    return res.json("Join request status updated successfully");
  } catch (error) {
    console.error("Error in updateJoinRequestStatus:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Recycle Requests
const fetchAllRequests = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { status } = req.query;
    const query = status
      ? "SELECT * FROM user_requests WHERE status = ?"
      : "SELECT * FROM user_requests";

    const data = await executeQuery(query, status ? [status] : []);

    return res.json(data);
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
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { searchTerm } = req.query;

    let selectQuery = "SELECT * FROM user_requests";
    const queryParams = [];

    if (searchTerm) {
      selectQuery += " WHERE user_id = ?";
      queryParams.push(searchTerm);
    }

    const data = await executeQuery(selectQuery, queryParams);

    return res.json(data);
  } catch (error) {
    console.error("Error in searchRequests:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update the request status per scenario
const updateRequestStatus = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { requestId } = req.params;
    const { status } = req.body;
    const type = status === 4 ? "hold" : null;

    const result = await executeQuery(
      "UPDATE user_requests SET status = ?, type = ? WHERE request_id = ?",
      [status, type, requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json("Request not found");
    }

    return res.json("Request status updated successfully");
  } catch (error) {
    console.error("Error in updateRequestStatus:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Recycle Bins
// All recycle Bins
const fetchAllRecycleBins = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { type } = req.query;
    const query = type
      ? "SELECT * FROM markers WHERE type = ?"
      : "SELECT * FROM markers";

    const data = await executeQuery(query, type ? [type] : []);

    return res.json(data);
  } catch (error) {
    console.error("Error in fetchAllRecycleBins:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Deactivate Bin
const deactivateBin = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { binId } = req.params;

    const updateQuery = "UPDATE markers SET active = 0 WHERE id = ?";
    const result = await executeQuery(updateQuery, [binId]);

    if (result.affectedRows === 0) {
      return res.status(404).json("Bin not found");
    }

    return res.json("Bin deactivated successfully");
  } catch (error) {
    console.error("Error in deactivateBin:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Activate Bin
const activateBin = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { binId } = req.params;

    const updateQuery = "UPDATE markers SET active = 1 WHERE id = ?";
    const result = await executeQuery(updateQuery, [binId]);

    if (result.affectedRows === 0) {
      return res.status(404).json("Bin not found");
    }

    return res.json("Bin activated successfully");
  } catch (error) {
    console.error("Error in activateBin:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update Bin
// Get bin by id
const getBinById = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decoded = jwt.verify(token, "jwtkey");
    if (decoded.role !== 1) {
      return res.status(403).json("Invalid user role");
    }

    const query = "SELECT * FROM markers WHERE id = ?";
    const result = await executeQuery(query, [req.params.binId]);
    console.log(result);

    if (result.length === 0) {
      return res.status(404).json("Bin not found");
    }

    return res.status(200).json(result[0]);
  } catch (error) {
    console.error("Error in getBinById:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update an existing bin
const updateBin = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { binId } = req.params;
    const updatedData = req.body;

    console.log("Bin ID:", binId);
    console.log("Updated Data:", updatedData);

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

    // If no matching bin found, proceed to update the bin
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
  } catch (error) {
    console.error("Error in updateBin:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Add New Bin
const addNewBin = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const userInfo = jwt.verify(token, "jwtkey");
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json("You are not authorized to access this resource");
    }

    const { address, city, lat, lng, type } = req.body;

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

    // If no matching bin found, proceed to insert the new bin
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
  } catch (error) {
    console.error("Error in addNewBin:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getAllUsers: getAllUsers,
  toggleUserActivation: toggleUserActivation,
  getAllJoinRequests: getAllJoinRequests,
  updateJoinRequestStatus: updateJoinRequestStatus,
  fetchAllRequests: fetchAllRequests,
  searchRequests: searchRequests,
  updateRequestStatus: updateRequestStatus,
  fetchAllRecycleBins: fetchAllRecycleBins,
  deactivateBin: deactivateBin,
  activateBin: activateBin,
  getBinById: getBinById,
  updateBin: updateBin,
  addNewBin: addNewBin,
};
