const express = require('express');
const { signUp } = require('../controllers/recyclerRegister.js');

const router = express.Router();

router.post('/recyclerRegister', signUp);

module.exports = router;
