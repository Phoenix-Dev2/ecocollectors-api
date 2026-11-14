const express = require('express');
const { WelcomeManagerData } = require('../controllers/welcomeManager');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLE } = require('../constants');
const router = express.Router();

router.get('/', requireAuth, requireRole(ROLE.ADMIN, ROLE.MANAGER), WelcomeManagerData);
module.exports = router;
