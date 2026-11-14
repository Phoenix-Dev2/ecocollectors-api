const express = require('express');

const {
  getUserRequests,
  updateRequestStatus,
} = require('../controllers/dashboardUser.js');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:id', getUserRequests);
router.put('/:id', updateRequestStatus);

module.exports = router;
