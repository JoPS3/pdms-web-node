const express = require('express');

const authGuiController = require('../controllers/auth.gui.controller');
const authApiController = require('../controllers/auth.api.controller');

const router = express.Router();

router.get('/', authGuiController.redirectRoot);
router.get('/login', authGuiController.renderLogin);
router.post('/login', authApiController.login);

router.get('/set-password', authGuiController.renderSetPassword);
router.post('/set-password', authApiController.setPassword);

router.get('/ask-password', authGuiController.renderAskPassword);
router.post('/verify-password', authApiController.verifyPassword);

router.post('/logout', authGuiController.logout);
router.get('/validate-session', authApiController.validateSession);

// Phase 2: Token-based authentication endpoints
router.post('/refresh-token', authApiController.refreshToken);

module.exports = router;
