const express = require('express');

const oneDriveController = require('../controllers/onedrive.controller');
const { requireServiceSession } = require('../middlewares/service-auth.middleware');

const router = express.Router();

router.get('/internal/onedrive/setup', requireServiceSession, oneDriveController.getSetup);
router.post('/internal/onedrive/setup', requireServiceSession, oneDriveController.saveSetup);
router.get('/internal/onedrive/status', requireServiceSession, oneDriveController.getStatus);
router.post('/internal/onedrive/connect', requireServiceSession, oneDriveController.startConnect);
router.get('/internal/onedrive/callback', oneDriveController.callback);
router.post('/internal/onedrive/disconnect', requireServiceSession, oneDriveController.disconnect);
router.post('/internal/onedrive/test/write', requireServiceSession, oneDriveController.smokeWrite);
router.get('/internal/onedrive/test/read', requireServiceSession, oneDriveController.smokeRead);

module.exports = router;
