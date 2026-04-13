const express = require('express');

const authController = require('../controllers/auth.controller');

const router = express.Router();

router.get('/', authController.redirectRoot);
router.get('/login', authController.renderLogin);
router.post('/login', authController.login);

router.get('/set-password', authController.renderSetPassword);
router.post('/set-password', authController.setPassword);

router.get('/ask-password', authController.renderAskPassword);
router.post('/verify-password', authController.verifyPassword);

router.post('/logout', authController.logout);
router.get('/validate-session', authController.validateSession);

module.exports = router;
