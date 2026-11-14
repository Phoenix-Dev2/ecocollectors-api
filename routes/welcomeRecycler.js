const express = require('express');
const { WelcomeRecyclerData } = require('../controllers/welcomeRecycler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLE } = require('../constants');
const router = express.Router();

router.get('/', requireAuth, requireRole(ROLE.ADMIN, ROLE.RECYCLER), WelcomeRecyclerData);
module.exports = router;
