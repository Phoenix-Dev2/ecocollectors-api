const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

// recyclers join requests
const fetchRecyclerJoinRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    // Get the status filter from the query parameters
    const statusFilter = req.query.status;

    // Construct the SQL query based on the status filter
    let selectQuery = 'SELECT * FROM recyclers_join_requests';
    if (statusFilter) {
      selectQuery += ' WHERE status = ?';
    }

    db.query(selectQuery, [statusFilter], (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

// Accept / Decline a join request
const updateRecyclerJoinRequestStatus = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is a manager
    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { joinID } = req.params;
    const newStatus = req.body.status;
    console.log('Join ID: ' + joinID);
    console.log('newStatus: ' + newStatus);

    const updateQuery =
      'UPDATE recyclers_join_requests SET status = ? WHERE join_id = ?';

    db.query(updateQuery, [newStatus, joinID], async (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) {
        return res.status(404).json('Join request not found');
      }

      // If the new status is 'Approved' (3), update the user's role to 4 (recycler manager)
      if (newStatus === 3) {
        try {
          // Update the user's role to 3 (recycler)
          const userQuery = 'UPDATE users SET role = ? WHERE ID = ?';
          await db.query(userQuery, [3, req.body.userID]);
        } catch (error) {
          console.error('Error updating user role:', error);
          return res.status(500).json('Error updating user role');
        }
      }

      return res.json('Join request status updated successfully');
    });
  });
};

// Recyclers Management

// All regional recyclers
const getAllRecyclers = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const selectQuery =
      'SELECT ID, role, first_name, last_name, email, city, address, phone, amount, active FROM users WHERE role = 3 OR role = 5'; // Filter by role = 3 / 5(demoted)

    db.query(selectQuery, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

// Deactivate recycler and toggle between role 3 and 5
const RecyclerDeactivation = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 4) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { userId } = req.params;

    const getUserRoleQuery = 'SELECT role FROM users WHERE ID = ?';

    db.query(getUserRoleQuery, [userId], (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.length === 0) {
        return res.status(404).json('User not found');
      }

      const currentRole = result[0].role;
      const newRole = currentRole === 3 ? 5 : 3; // Toggle between 3 and 5

      const updateQuery = 'UPDATE users SET role = ? WHERE ID = ?';

      db.query(updateQuery, [newRole, userId], (err, updateResult) => {
        if (err) return res.status(500).json(err);
        if (updateResult.affectedRows === 0) {
          return res.status(404).json('User not found');
        }
        return res.json('User role updated successfully');
      });
    });
  });
};

// Recycle Requests

// Fetch all regional requests - geo
const fetchAllRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 4) {
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
    if (userInfo.role !== 4) {
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

// Update the request status to 'hold'
const updateRequestStatus = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is an administrator
    if (userInfo.role !== 4) {
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

module.exports = {
  fetchRecyclerJoinRequests: fetchRecyclerJoinRequests,
  updateRecyclerJoinRequestStatus: updateRecyclerJoinRequestStatus,
  getAllRecyclers: getAllRecyclers,
  RecyclerDeactivation: RecyclerDeactivation,
  fetchAllRequests: fetchAllRequests,
  searchRequests: searchRequests,
  updateRequestStatus: updateRequestStatus,
};
