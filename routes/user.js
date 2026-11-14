const express = require('express');
const {
  updateUser,
  changePassword,
  getUserInfo,
  getUserRole,
  deactivateAccount,
  sendEmail,
} = require('../controllers/user');
const { requireAuth } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimits');
const router = express.Router();

// Auth is set per route: this router is mounted on /user, in front of the /user/welcome* routers.
router.put('/update', requireAuth, updateUser);
router.put('/change-password', requireAuth, changePassword);
router.get('/info', requireAuth, getUserInfo);
router.get('/role', requireAuth, getUserRole);
router.post('/deactivate', requireAuth, deactivateAccount);
router.post('/sendEmail', contactLimiter, sendEmail);

module.exports = router;
