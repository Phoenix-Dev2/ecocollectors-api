const express = require('express');
const {
  updateUser,
  changePassword,
  getUserInfo,
  getUserRole,
  deactivateAccount,
  sendEmail,
} = require('../controllers/user');
const router = express.Router();

router.post('/user');
router.put('/update', updateUser);
router.put('/change-password', changePassword);
router.get('/info', getUserInfo);
router.get('/role', getUserRole);
router.post('/deactivate', deactivateAccount);
router.post('/sendEmail', sendEmail);

module.exports = router;
