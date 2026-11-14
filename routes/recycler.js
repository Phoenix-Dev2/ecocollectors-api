const express = require('express');
const recyclerControllers = require('../controllers/recycler.js');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLE } = require('../constants');

const router = express.Router();

router.use(requireAuth, requireRole(ROLE.RECYCLER));

// Recycle Requests
router.get('/all-requests', recyclerControllers.fetchAllRequests);
router.put('/requests/:requestId', recyclerControllers.updateRequestStatus);
router.get('/accepted-requests', recyclerControllers.fetchAcceptedRequests);
router.get('/completed-requests', recyclerControllers.fetchCompletedRequests);

module.exports = router;
