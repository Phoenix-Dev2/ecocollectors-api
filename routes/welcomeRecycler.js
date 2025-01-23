const express = require('express');
const { WelcomeRecyclerData } = require('../controllers/welcomeRecycler');
const router = express.Router();

router.get('/', WelcomeRecyclerData);
module.exports = router;
