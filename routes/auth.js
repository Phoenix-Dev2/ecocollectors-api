const express = require('express');
const authControllers = require('../controllers/auth.js');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/register', authLimiter, authControllers.register);
router.post('/login', authLimiter, authControllers.login);
// GET stays while the current client uses it; POST is for the next client release.
router.get('/logout', authControllers.logout);
router.post('/logout', authControllers.logout);
router.post('/forgotPassword', passwordResetLimiter, authControllers.forgotPassword);
router.get('/checkActivation', authLimiter, authControllers.checkActivation);

module.exports = router;
