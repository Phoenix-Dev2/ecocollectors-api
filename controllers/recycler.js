const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

const fetchAllRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is a recycler
    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { status } = req.query;

    let selectQuery =
      'SELECT user_requests.*, users.first_name AS recycler_first_name, users.last_name AS recycler_last_name FROM user_requests';
    selectQuery += ' LEFT JOIN users ON user_requests.recycler_id = users.ID'; // Joining the users table
    const queryParams = [];

    if (status) {
      selectQuery += ' WHERE user_requests.status = ?';
      queryParams.push(status);
    }

    db.query(selectQuery, queryParams, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

const fetchAcceptedRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is a recycler
    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const selectQuery = `
      SELECT ur.*, CONCAT(u.first_name, ' ', u.last_name) AS recycler_name
      FROM user_requests ur
      LEFT JOIN users u ON ur.recycler_id = u.ID
      WHERE ur.recycler_id = ? AND (ur.status = 2 OR ur.status = 5)
    `;
    const queryParams = [userInfo.id];

    db.query(selectQuery, queryParams, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

// Cancel a request
const updateRequestStatus = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is a recycler
    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const { requestId } = req.params;
    const { status } = req.body;
    const type = 'request';

    const updateQuery =
      'UPDATE user_requests SET recycler_id = NULL, status = ?, type = ? WHERE request_id = ?';

    db.query(updateQuery, [status, type, requestId], (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0) {
        return res.status(404).json('Request not found');
      }
      return res.json('Request status updated successfully');
    });
  });
};

// fetch recycler completed requests
const fetchCompletedRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    // Check if the user is a recycler
    if (userInfo.role !== 3) {
      return res
        .status(403)
        .json('You are not authorized to access this resource');
    }

    const selectQuery = `
      SELECT ur.*, CONCAT(u.first_name, ' ', u.last_name) AS recycler_name
      FROM user_requests ur
      LEFT JOIN users u ON ur.recycler_id = u.ID
      WHERE ur.recycler_id = ? AND ur.status = 3
    `;
    const queryParams = [userInfo.id];

    db.query(selectQuery, queryParams, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json(data);
    });
  });
};

module.exports = {
  fetchAllRequests: fetchAllRequests,
  fetchAcceptedRequests: fetchAcceptedRequests,
  updateRequestStatus: updateRequestStatus,
  fetchCompletedRequests: fetchCompletedRequests,
};
