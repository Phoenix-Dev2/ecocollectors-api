const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

// Utility function to get current date and time in 'YYYY-MM-DD HH:mm:ss' format with GMT+3 offset
const getCurrentDateTime = () => {
  const now = new Date();
  now.setHours(now.getHours() + 3); // Add 3 hours to account for GMT+3
  const formattedDate = now.toISOString().slice(0, 19).replace('T', ' ');
  return formattedDate;
};

const getRequests = (req, res) => {
  const q = 'SELECT * FROM user_requests WHERE status = 1 OR status = 2';
  db.query(q, (err, data) => {
    if (err) {
      console.error(err); // Log the error message
      return res.status(500).send(err);
    }
    return res.status(200).json(data);
  });
};

// Not for recycle requests purposes - update
const getRequest = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decoded) => {
    if (err) return res.status(403).json('Token is not valid');
    const userRole = decoded.role;
    if (
      userRole === 1 ||
      userRole === 2 ||
      userRole === 3 ||
      userRole === 4 ||
      userRole === 5
    ) {
      const q =
        'SELECT `request_id`,`user_id`,`full_name`,`req_lat`, `req_lng`, `req_address`,`phone_number`,`bottles_number`,`from_hour`,`to_hour`,`request_date`,`completed_date`,`status`,`type` FROM user_requests WHERE request_id = ?';
      db.query(q, [req.params.id], (err, data) => {
        if (err) return res.status(500).send(err);
        console.log(data[0]);
        return res.status(200).json(data[0]);
      });
    } else {
      return res.status(403).json('Invalid user role');
    }
  });
};

// for recycle requests purposes - Collect request
const getRequestForRecycle = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decoded) => {
    if (err) return res.status(403).json('Token is not valid');
    const userRole = decoded.role;
    if (
      userRole === 1 || // Administrator
      userRole === 3 || // Recycler
      userRole === 4 // Manager
    ) {
      const q =
        'SELECT `request_id`,`user_id`,`full_name`,`req_lat`, `req_lng`, `req_address`,`phone_number`,`bottles_number`,`from_hour`,`to_hour`,`request_date`,`completed_date`,`status`,`type` FROM user_requests WHERE request_id = ?';
      db.query(q, [req.params.id], (err, data) => {
        if (err) return res.status(500).send(err);
        console.log(data[0]);
        return res.status(200).json(data[0]);
      });
    } else {
      return res.status(403).json('Invalid user role');
    }
  });
};

const addRequest = (req, res) => {
  const token = req.cookies.access_token;
  const reqStatus = 1;
  const reqType = 'request';
  //const reqLat = parseFloat(req.body.reqLat);
  //const reqLng = parseFloat(req.body.reqLng);
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decoded) => {
    if (err) return res.status(403).json('Token is not valid');
    const userId = decoded.id;

    const q =
      'INSERT INTO user_requests (`user_id`,`full_name`,`req_lat`,`req_lng`,`req_address`,`phone_number`,`bottles_number`,`from_hour`,`to_hour`,`request_date`,`status`,`type`) VALUES (?)';

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
    db.query(q, [values], (err, data) => {
      if (err) return res.status(500).send(err);
      return res.status(200).json('Request has been created');
    });
  });
};

const deleteRequest = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid');
    const requestId = req.params.is;
    const q =
      'DELETE FROM user_request WHERE `request_id` = ? AND `user_id` = ?  ';

    db.query(q, [requestId, userInfo.id], (err, data) => {
      if (err)
        return res.status(403).json('You can delete only your requests!');
      return res.json('Request has been deleted!');
    });
  });
};

const updateRequestType = (req, res) => {
  const token = req.cookies.access_token;
  const type = 'pending';
  const status = 2;
  if (!token) return res.status(401).json('Not authenticated!');

  jwt.verify(token, 'jwtkey', (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');
    //console.log('User Id:' + userInfo.id);
    const requestId = req.params.id;
    const q =
      'UPDATE user_requests SET `recycler_id`=?, `status`=?, `type`=?, `completed_date`=DATE_FORMAT(?, "%Y-%m-%d %H:%i:%s") WHERE `request_id` = ?';
    const completedDate = getCurrentDateTime();
    const values = [userInfo.id, status, type, completedDate];

    db.query(q, [...values, requestId], (err, data) => {
      if (err) return res.status(500).json(err);
      return res.json('Request has been updated.');
    });
  });
};

const updateRequestByUser = (req, res) => {
  //console.log('In updateRequestByUser');
  const token = req.cookies.access_token;

  if (!token) return res.status(401).json('Not authenticated!');

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(403).json('Token is not valid!');

    const requestId = req.params.id; // Request ID
    const updatedData = req.body; // Updated data sent from frontend

    console.log('Updated Data:', updatedData);

    // Retrieve the request to check user_id
    const getRequestQuery =
      'SELECT user_id FROM user_requests WHERE request_id = ?';

    db.query(getRequestQuery, [requestId], (err, requestResult) => {
      if (err) {
        console.error(err);
        return res.status(500).json(err);
      }

      const userId = userInfo.id;
      const userRole = userInfo.role;
      const requestUserId = requestResult[0].user_id;

      //console.log('User ID:', userId);
      //console.log('User Role:', userRole);
      //console.log('Request User ID:', requestUserId);

      // Check if the user is authorized to update this request
      if (userRole === 1 || requestUserId === userId) {
        let updateQuery = 'UPDATE user_requests SET ';
        const values = [];

        for (const key in updatedData) {
          if (key !== 'request_id') {
            // Exclude updating request_id
            updateQuery += `${key}=?, `;
            values.push(updatedData[key]);
          }
        }

        updateQuery += '`request_date`=NOW() WHERE `request_id` = ?';
        values.push(requestId);

        //console.log('Update Query:', updateQuery);
        console.log('Update Values:', values);

        db.query(updateQuery, values, (err, data) => {
          if (err) {
            console.error(err);
            return res.status(500).json(err);
          }
          return res.json('Request has been updated by user.');
        });
      } else {
        return res
          .status(403)
          .json('You are not authorized to update this request.');
      }
    });
  });
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
