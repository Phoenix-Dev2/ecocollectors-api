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

const router = express.Router();

router.get('/', getRequests);
router.get('/recycle/:id', getRequestForRecycle);
router.get('/:id', getRequest);
router.post('/add', addRequest);
router.delete('/:id', deleteRequest);
router.put('/:id', updateRequestType);
router.put('/userUpdate/:id', updateRequestByUser);

module.exports = router;
