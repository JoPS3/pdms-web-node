const express = require('express');

const authController = require('../controllers/auth.controller');

const router = express.Router();

router.get('/', authController.redirectRoot);
router.get('/login', authController.renderLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

module.exports = router;
