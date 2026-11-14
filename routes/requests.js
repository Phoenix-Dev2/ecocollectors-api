const express = require('express');
const {
  getRequests,
  getRequest,
  getRequestForRecycle,
  addRequest,
  deleteRequest,
  updateRequestType,
  updateRequestByUser,
} = require('../controllers/requests.js');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { ROLE } = require('../constants');

const router = express.Router();

// Who may collect requests (the map shows "Collect" to these roles)
const collectors = requireRole(ROLE.ADMIN, ROLE.RECYCLER, ROLE.MANAGER);

router.get('/', optionalAuth, getRequests);
router.get('/recycle/:id', requireAuth, collectors, getRequestForRecycle);
router.get('/:id', requireAuth, getRequest);
router.post('/add', requireAuth, addRequest);
router.delete('/:id', requireAuth, deleteRequest);
router.put('/:id', requireAuth, collectors, updateRequestType);
router.put('/userUpdate/:id', requireAuth, updateRequestByUser);

module.exports = router;
