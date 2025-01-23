const { db } = require('../db.js');
const jwt = require('jsonwebtoken');

const getRecyclerDetails = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json('Not authenticated');

  jwt.verify(token, 'jwtkey', (err, decoded) => {
    if (err) return res.status(403).json('Token is not valid');
    const recyclerId = req.params.id; // Assuming recycler ID is passed as a route parameter
    const q = 'SELECT first_name, last_name, phone FROM users WHERE ID = ?';
    db.query(q, recyclerId, (err, data) => {
      if (err) return res.status(500).send(err);
      return res.status(200).json(data);
    });
  });
};

module.exports = {
  getRecyclerDetails: getRecyclerDetails,
};
