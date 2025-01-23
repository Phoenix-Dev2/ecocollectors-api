const { db } = require('../db.js');

const getActiveMarkers = (req, res) => {
  const q = req.query.type
    ? 'SELECT * FROM markers WHERE type=? AND active=1'
    : 'SELECT * FROM markers WHERE active=1';
  db.query(q, [req.query.type], (err, data) => {
    if (err) return res.send(err);
    return res.status(200).json(data);
  });
};

module.exports = {
  getActiveMarkers: getActiveMarkers,
};
