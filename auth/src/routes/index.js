const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireGatewaySessionApi, validateGatewaySession } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'auth',
    status: 'ok',
    db: process.env.DB_NAME || 'pedaco-auth',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/session/check
 * Verifica SE há um token ativo SEM redirecionar
 * Útil para testar se a sessão está ativa
 */
router.get('/api/session/check', async (req, res) => {
  try {
    const validation = await validateGatewaySession(req);
    
    return res.status(validation.valid ? 200 : 401).json({
      status: validation.valid ? 'active' : 'inactive',
      session: {
        valid: validation.valid,
        reason: validation.reason || null,
        user: validation.user || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      error: 'validation_failed',
      message: error.message
    });
  }
});

/**
 * GET /api/session/status
 * Verifica o token de sessão com o gateway
 * Retorna 401 se inválido/ausente, 200 se válido com dados da sessão
 */
router.get('/api/session/status', requireGatewaySessionApi, authController.getSessionStatus);

router.post('/internal/session/status', requireGatewaySessionApi, authController.getInternalSessionStatus);
router.post('/internal/session/change-password', requireGatewaySessionApi, authController.changeInternalSessionPassword);
router.get('/internal/onedrive/setup', requireGatewaySessionApi, authController.getInternalOneDriveSetup);
router.post('/internal/onedrive/setup', requireGatewaySessionApi, authController.saveInternalOneDriveSetup);
router.get('/internal/onedrive/status', requireGatewaySessionApi, authController.getInternalOneDriveStatus);
router.post('/internal/onedrive/connect', requireGatewaySessionApi, authController.startInternalOneDriveConnect);
router.post('/internal/onedrive/disconnect', requireGatewaySessionApi, authController.disconnectInternalOneDrive);
router.post('/internal/users/:userId/update', requireGatewaySessionApi, authController.updateUserFromEdit);

module.exports = router;
