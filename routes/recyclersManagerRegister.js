const express = require('express');
const { signUp } = require('../controllers/recyclersManagerRegister');

const router = express.Router();

router.post('/recyclerManagerRegister', signUp);

module.exports = router;
