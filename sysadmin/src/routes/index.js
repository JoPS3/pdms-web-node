const express = require('express');
const authController = require('../controllers/sysadmin.api.controller');
const usersApiController = require('../controllers/users.api.controller');
const onedriveController = require('../controllers/onedrive.api.controller');
const { requireGatewaySessionApi, validateGatewaySession } = require('../middlewares/session.middleware');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'sysadmin',
    status: 'ok',
    db: process.env.DB_NAME || 'pedaco-000',
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
router.get('/internal/onedrive/setup', requireGatewaySessionApi, onedriveController.getInternalOneDriveSetup);
router.post('/internal/onedrive/setup', requireGatewaySessionApi, onedriveController.saveInternalOneDriveSetup);
router.get('/internal/onedrive/status', requireGatewaySessionApi, onedriveController.getInternalOneDriveStatus);
router.post('/internal/onedrive/connect', requireGatewaySessionApi, onedriveController.startInternalOneDriveConnect);
router.post('/internal/onedrive/disconnect', requireGatewaySessionApi, onedriveController.disconnectInternalOneDrive);
router.post('/internal/users/:userId/update', requireGatewaySessionApi, usersApiController.updateUserFromEdit);

module.exports = router;
