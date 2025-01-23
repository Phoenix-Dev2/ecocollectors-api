const express = require('express');

const {
  getUserRequests,
  updateRequestStatus,
} = require('../controllers/dashboardUser.js');

const router = express.Router();

router.get('/:id', getUserRequests);
router.put('/:id', updateRequestStatus);

module.exports = router;
