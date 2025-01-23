const express = require('express');
const managerControllers = require('../controllers/manager.js');
const router = express.Router();

// Recyclers Join requests
router.get('/join-requests', managerControllers.fetchRecyclerJoinRequests);
router.put(
  '/join-requests/:joinID',
  managerControllers.updateRecyclerJoinRequestStatus
);
// Recyclers Management
router.get('/recyclers', managerControllers.getAllRecyclers);
router.put('/recyclers/:userId', managerControllers.RecyclerDeactivation);
// Recycle Requests
router.get('/all-requests', managerControllers.fetchAllRequests);
router.put('/requests/:requestId', managerControllers.updateRequestStatus);
router.get('/search-requests', managerControllers.searchRequests);

module.exports = router;
