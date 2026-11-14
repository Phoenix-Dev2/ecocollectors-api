const express = require('express');
const { signUp } = require('../controllers/recyclersManagerRegister');
const { optionalAuth } = require('../middleware/auth');
const { joinLimiter } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/recyclerManagerRegister', joinLimiter, optionalAuth, signUp);

module.exports = router;
