const express = require('express');
const authControllers = require('../controllers/auth.js');

const router = express.Router();

router.post('/register', authControllers.register);
router.post('/login', authControllers.login);
router.get('/logout', authControllers.logout);
router.post('/forgotPassword', authControllers.forgotPassword);
router.get('/checkActivation', authControllers.checkActivation);

module.exports = router;
