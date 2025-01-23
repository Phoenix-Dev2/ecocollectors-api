const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

// Users
const getAllUsers = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const selectQuery =
      'SELECT ID, role, first_name, last_name, email, city, address, phone, amount, active FROM users WHERE role != 1';

    db.query(selectQuery, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

const toggleUserActivation = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { userId } = req.params;
    const { active } = req.body;
    //console.log('User ID: ' + userId);
    //console.log('Active: ' + active);

    const updateQuery = 'UPDATE users SET active = ? WHERE ID = ?';

    db.query(updateQuery, [active, userId], (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) {
        return res.status(404).json('User not found');
      }
      return res.json('User activation status updated successfully');
    });
  });
};

// Recyclers Managers

const getAllJoinRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    // Get the status filter from the query parameters
    const statusFilter = req.query.status;

    // Construct the SQL query based on the status filter
    let selectQuery = 'SELECT * FROM recyclers_manager_join_requests';
    if (statusFilter) {
      selectQuery += ' WHERE status = ?';
    }

    db.query(selectQuery, [statusFilter], (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

const updateJoinRequestStatus = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { joinID } = req.params;
    const newStatus = req.body.status;
    console.log('Join ID: ' + joinID);
    console.log('newStatus: ' + newStatus);

    const updateQuery =
      'UPDATE recyclers_manager_join_requests SET status = ? WHERE join_id = ?';

    db.query(updateQuery, [newStatus, joinID], async (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) {
        return res.status(404).json('Join request not found');
      }

      // If the new status is 'Approved' (3), update the user's role to 4 (recycler manager)
      if (newStatus === 3) {
        try {
          // Update the user's role to 4 (recycler manager)
          const userQuery = 'UPDATE users SET role = ? WHERE ID = ?';
          await db.query(userQuery, [4, req.body.userID]);
        } catch (error) {
          console.error('Error updating user role:', error);
          return res.status(500).json('Error updating user role');
        }
      }

      return res.json('Join request status updated successfully');
    });
  });
};

// Recycle Requests

const fetchAllRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { status } = req.query;

    let selectQuery = 'SELECT * FROM user_requests';
    const queryParams = [];

    if (status) {
      selectQuery += ' WHERE status = ?';
      queryParams.push(status);
    }

    db.query(selectQuery, queryParams, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

// Search requests by user_id
const searchRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { searchTerm } = req.query;

    let selectQuery = 'SELECT * FROM user_requests';
    const queryParams = [];

    if (searchTerm) {
      selectQuery += ' WHERE user_id = ? ';
      queryParams.push(searchTerm, searchTerm);
    }

    db.query(selectQuery, queryParams, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

// Update the request status per scenario
const updateRequestStatus = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { requestId } = req.params;
    const { status } = req.body;

    // Set 'type' field to 'pending' when changing status to 4 (Hold)
    const type = status === 4 ? 'hold' : null;

    const updateQuery =
      'UPDATE user_requests SET status = ?, type = ? WHERE request_id = ?';

    db.query(updateQuery, [status, type, requestId], (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) {
        return res.status(404).json('Request not found');
      }
      return res.json('Request status updated successfully');
    });
  });
};

// Recycle Bins
// All recycle Bins
const fetchAllRecycleBins = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { type } = req.query;

    let selectQuery = 'SELECT * FROM markers';
    const queryParams = [];

    if (type) {
      selectQuery += ' WHERE type = ?';
      queryParams.push(type);
    }

    db.query(selectQuery, queryParams, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

// Deactivate Bin
const deactivateBin = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { binId } = req.params;

    const updateQuery = 'UPDATE markers SET active = 0 WHERE id = ?';

    db.query(updateQuery, [binId], (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) {
        return res.status(404).json('Bin not found');
      }
      return res.json('Bin deactivated successfully');
    });
  });
};

// Activate Bin
const activateBin = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { binId } = req.params;

    const updateQuery = 'UPDATE markers SET active = 1 WHERE id = ?';

    db.query(updateQuery, [binId], (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) {
        return res.status(404).json('Bin not found');
      }
      return res.json('Bin deactivated successfully');
    });
  });
};

// Update Bin
// Get bin by id
const getBinById = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decoded) => {
    if (err) return res.status(403).json('Token is not valid');

    const userRole = decoded.role;
    if (userRole === 1) {
      const q = 'SELECT * FROM markers WHERE id = ?';

      db.query(q, [req.params.binId], (err, data) => {
        if (err) return res.status(500).send(err);
        if (data.length === 0) {
          return res.status(404).json('Bin not found');
        }

        return res.status(200).json(data[0]);
      });
    } else {
      return res.status(403).json('Invalid user role');
    }
  });
};

// Update an existing bin
const updateBin = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { binId } = req.params;
    const updatedData = req.body; // Updated data sent from frontend
    console.log('Bin ID:', binId);
    console.log('Updated Data:', updatedData);

    // Round the lat and lng values to a specific precision (e.g., 6 decimal places)
    const precision = 6;
    const roundedLat = Number(updatedData.lat).toFixed(precision);
    const roundedLng = Number(updatedData.lng).toFixed(precision);

    // Check if a bin with the same Latitude, Longitude, and type already exists
    const existingBinQuery =
      'SELECT COUNT(*) AS binCount FROM markers WHERE ROUND(lat, ?) = ? AND ROUND(lng, ?) = ? AND type = ? AND id <> ?';
    db.query(
      existingBinQuery,
      [precision, roundedLat, precision, roundedLng, updatedData.type, binId],
      (err, existingBinData) => {
        if (err) return res.status(500).json(err);

        if (existingBinData[0].binCount > 0) {
          return res
            .status(400)
            .json('A bin with this address and type already exists');
        }

        // If no matching bin found, proceed to update the bin
        const updateQuery =
          'UPDATE markers SET address = ?, city = ?, lat = ?, lng = ?, type = ?, last_modified = ? WHERE id = ?';

        const values = [
          updatedData.address || null,
          updatedData.city || null,
          updatedData.lat || null,
          updatedData.lng || null,
          updatedData.type || null,
          new Date(),
          binId,
        ];

        db.query(updateQuery, values, (err, result) => {
          if (err) return res.status(500).json(err);
          if (result.affectedRows === 0) {
            return res.status(404).json('Bin not found');
          }
          return res.json('Bin updated successfully');
        });
      }
    );
  });
};

// Add New Bin
const addNewBin = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 1) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { address, city, lat, lng, type } = req.body;

    // Fix precision to a specific number of decimal places (e.g., 6 decimal places)
    const precision = 6;
    const latFixed = parseFloat(lat).toFixed(precision);
    const lngFixed = parseFloat(lng).toFixed(precision);

    // Check if any bins with the same Latitude, Longitude, and type already exist
    const existingBinQuery =
      'SELECT COUNT(*) AS binCount FROM markers WHERE lat = ? AND lng = ? AND type = ?';
    db.query(existingBinQuery, [latFixed, lngFixed, type], (err, result) => {
      if (err) return res.status(500).json(err);

      const binCount = result[0].binCount;

      if (binCount > 0) {
        return res
          .status(400)
          .json({ error: 'A bin with this address and type already exists' });
      }

      // If no matching bin found, proceed to insert the new bin
      const insertQuery =
        'INSERT INTO markers (address, city, lat, lng, type, active, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?)';

      const values = [
        address || null,
        city || null,
        latFixed || null,
        lngFixed || null,
        type || null,
        1, // Set as active
        new Date(),
      ];

      db.query(insertQuery, values, (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json('Bin added successfully');
      });
    });
  });
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
