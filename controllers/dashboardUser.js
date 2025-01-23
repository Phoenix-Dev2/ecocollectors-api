const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

const getUserRequests = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decoded) => {
    if (err) return res.status(403).json('Token is not valid');
    const userId = decoded.id;
    const q = 'SELECT * FROM user_requests WHERE user_id = ?';
    db.query(q, userId, (err, data) => {
      if (err) return res.status(500).send(err);
      //console.log(data[0]);
      return res.status(200).json(data);
    });
  });
};

// Update request status
const updateRequestStatus = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decoded) => {
    if (err) return res.status(403).json('Token is not valid');

    const requestId = req.params.id;
    const { status, newBottlesNumber } = req.body; // Get the new status and newBottlesNumber from the request body

    let type;
    if (status === 1) {
      type = 'request';
    } else if (status === 3) {
      type = 'completed';
    } else {
      // for map rendering purposes
      type = 'pending';
    }

    // Bottles number and user_id values
    const getRequestQuery =
      'SELECT bottles_number, user_id FROM user_requests WHERE request_id = ?';

    db.query(getRequestQuery, [requestId], (err, result) => {
      if (err) return res.status(500).send(err);

      if (result.length === 0) {
        return res.status(404).json('Request not found');
      }

      const { bottles_number, user_id } = result[0];

      console.log('user_id: ' + user_id);
      console.log('bottles_number: ' + bottles_number);
      console.log('newBottlesNumber: ' + newBottlesNumber);

      let recyclerId;
      const q = 'SELECT recycler_id FROM user_requests WHERE request_id = ?';

      db.query(q, [requestId], (err, result) => {
        if (err) return res.status(500).send(err);

        recyclerId = result[0].recycler_id;

        if (status === 4 || status === 1) {
          recyclerId = null;
        }

        const updateQ =
          'UPDATE user_requests SET `status`=?, `type`=?, `recycler_id`=?, `completed_date`= CASE WHEN ? = 3 THEN NOW() ELSE NULL END WHERE `request_id` = ?';

        db.query(
          updateQ,
          [status, type, recyclerId, status, requestId],
          (err, data) => {
            if (err) return res.status(500).send(err);

            // Update the user's amount if the status changed to 3
            if (status === 3) {
              const updateAmountQ =
                'UPDATE users SET amount = amount + ? WHERE ID = ?';

              db.query(
                updateAmountQ,
                [newBottlesNumber, user_id],
                (err, userData) => {
                  if (err) return res.status(500).send(err);

                  // Update the bottles_number in the user_requests table
                  const updateBottlesNumberQ =
                    'UPDATE user_requests SET `bottles_number`=? WHERE `request_id` = ?';
                  db.query(
                    updateBottlesNumberQ,
                    [newBottlesNumber, requestId],
                    (err, bottlesData) => {
                      if (err) return res.status(500).send(err);

                      // Add the bottles_number to the recycler's amount
                      if (recyclerId) {
                        const updateRecyclerAmountQ =
                          'UPDATE users SET amount = amount + ? WHERE ID = ?';

                        db.query(
                          updateRecyclerAmountQ,
                          [newBottlesNumber, recyclerId],
                          (err, recyclerData) => {
                            if (err) return res.status(500).send(err);

                            // Update the completed_date to the current time
                            const completedQ =
                              'UPDATE user_requests SET `completed_date`= NOW() WHERE `request_id` = ?';

                            db.query(completedQ, [requestId], (err, data) => {
                              if (err) return res.status(500).send(err);
                              return res.status(200).json(data);
                            });
                          }
                        );
                      } else {
                        // Update the completed_date to the current time
                        const completedQ =
                          'UPDATE user_requests SET `completed_date`= NOW() WHERE `request_id` = ?';

                        db.query(completedQ, [requestId], (err, data) => {
                          if (err) return res.status(500).send(err);
                          return res.status(200).json(data);
                        });
                      }
                    }
                  );
                }
              );
            } else {
              return res.status(200).json(data);
            }
          }
        );
      });
    });
  });
};

module.exports = {
  getUserRequests: getUserRequests,
  updateRequestStatus: updateRequestStatus,
};
