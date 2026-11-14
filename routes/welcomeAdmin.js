const express = require('express');
const { getWelcomeAdminData } = require('../controllers/welcomeAdmin');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLE } = require('../constants');
const router = express.Router();

router.get('/', requireAuth, requireRole(ROLE.ADMIN), getWelcomeAdminData);

module.exports = router;
