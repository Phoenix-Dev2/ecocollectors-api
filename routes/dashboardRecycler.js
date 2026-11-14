const express = require('express');

const { getRecyclerDetails } = require('../controllers/dashboardRecycler.js');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', requireAuth, getRecyclerDetails);

module.exports = router;
