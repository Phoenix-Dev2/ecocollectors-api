const express = require('express');
const recyclerControllers = require('../controllers/recycler.js');

const router = express.Router();

// Recycle Requests
router.get('/all-requests', recyclerControllers.fetchAllRequests);
router.put('/requests/:requestId', recyclerControllers.updateRequestStatus);
router.get('/accepted-requests', recyclerControllers.fetchAcceptedRequests);
router.get('/completed-requests', recyclerControllers.fetchCompletedRequests);

module.exports = router;
