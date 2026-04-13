const express = require('express');

const appsController = require('../controllers/apps.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', appsController.listApps);

module.exports = router;
