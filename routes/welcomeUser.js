const express = require('express');
const { WelcomeUserData } = require('../controllers/welcomeUser');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, WelcomeUserData);
module.exports = router;
