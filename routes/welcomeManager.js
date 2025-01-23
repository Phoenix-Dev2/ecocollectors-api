const express = require('express');
const { WelcomeManagerData } = require('../controllers/welcomeManager');
const router = express.Router();

router.get('/', WelcomeManagerData);
module.exports = router;
