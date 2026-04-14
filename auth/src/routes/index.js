const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireGatewaySessionApi } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'auth',
    status: 'ok',
    db: process.env.DB_NAME || 'pedaco-auth',
    timestamp: new Date().toISOString()
  });
});

router.post('/internal/session/status', requireGatewaySessionApi, authController.getInternalSessionStatus);
router.post('/internal/session/change-password', requireGatewaySessionApi, authController.changeInternalSessionPassword);
router.post('/internal/users/:userId/update', requireGatewaySessionApi, authController.updateUserFromEdit);

module.exports = router;
