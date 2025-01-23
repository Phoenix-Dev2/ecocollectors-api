const { db } = require('../db.js');

const signUp = (req, res) => {
  // Check Existing user
  const q = 'SELECT * FROM recyclers_manager_join_requests WHERE email = ?';

  db.query(q, [req.body.email], (err, data) => {
    if (err) return res.json(err);
    if (data.length) {
      return res
        .status(400)
        .json('Please be patient we will be in contact soon!');
    }

    // Set the `status` field to 1 (open) when registering a new user
    req.body.status = 1;

    const insertQuery =
      'INSERT INTO recyclers_manager_join_requests(`join_date`,`first_name`,`last_name`,`email`,`phone`,`message`,`user_id`,`status`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [
      req.body.join_date,
      req.body.first_name,
      req.body.last_name,
      req.body.email,
      req.body.phone,
      req.body.message,
      req.body.user_id,
      req.body.status, // Include the status field in the insert query
    ];

    db.query(insertQuery, values, (err, data) => {
      if (err) return res.json(err);
      return res.status(200).json('Request has been sent');
    });
  });
};

module.exports = {
  signUp: signUp,
};
