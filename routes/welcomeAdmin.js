const express = require('express');
const { getWelcomeAdminData } = require('../controllers/welcomeAdmin');
const router = express.Router();

router.get('/', getWelcomeAdminData);

module.exports = router;
