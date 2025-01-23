const express = require('express');

const { getRecyclerDetails } = require('../controllers/dashboardRecycler.js');

const router = express.Router();

router.get('/:id', getRecyclerDetails);

module.exports = router;
