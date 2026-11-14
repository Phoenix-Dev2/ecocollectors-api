const express = require('express');
const { signUp } = require('../controllers/recyclerRegister.js');
const { optionalAuth } = require('../middleware/auth');
const { joinLimiter } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/recyclerRegister', joinLimiter, optionalAuth, signUp);

module.exports = router;
