const express = require('express');
const {
  getAllUsers,
  toggleUserActivation,
  getAllJoinRequests,
  updateJoinRequestStatus,
  fetchAllRequests,
  searchRequests,
  updateRequestStatus,
  fetchAllRecycleBins,
  deactivateBin,
  activateBin,
  getBinById,
  updateBin,
  addNewBin,
} = require('../controllers/admin');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLE } = require('../constants');
const router = express.Router();

router.use(requireAuth, requireRole(ROLE.ADMIN));

// Users
router.get('/users', getAllUsers);
router.put('/users/:userId', toggleUserActivation);
// Recyclers Managers Join Requests
router.get('/join-requests', getAllJoinRequests);
router.put('/join-requests/:joinID', updateJoinRequestStatus);
// Recycle Requests
router.get('/all-requests', fetchAllRequests);
router.put('/requests/:requestId', updateRequestStatus);
router.get('/search-requests', searchRequests);
// Recycle Bins (state changes are PUT/POST only)
router.get('/bins/:binId', getBinById);
router.get('/recycleBins', fetchAllRecycleBins);
router.put('/deactivateBin/:binId', deactivateBin);
router.put('/activateBin/:binId', activateBin);
router.put('/bins/:binId', updateBin);
router.post('/bins', addNewBin);

module.exports = router;
