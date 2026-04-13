const express = require('express');
const mapasController = require('../controllers/mapas.controller');
const { requireGatewaySessionApi } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'mapas',
    status: 'ok',
    db: process.env.DB_NAME || 'pedaco-mapas',
    timestamp: new Date().toISOString()
  });
});

router.post('/internal/diario-caixa/upsert', requireGatewaySessionApi, mapasController.upsertInternalDiarioCaixa);
router.post('/internal/diario-caixa/existence', requireGatewaySessionApi, mapasController.checkInternalDiarioCaixa);
router.post('/internal/auditoria/log', requireGatewaySessionApi, mapasController.createInternalAuditoriaLog);
router.post('/internal/auditoria/query', requireGatewaySessionApi, mapasController.queryInternalAuditoriaLogs);

module.exports = router;
