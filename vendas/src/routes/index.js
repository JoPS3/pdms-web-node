const express = require('express');
const { requireGatewayAuth } = require('../middlewares/auth.middleware');
const indexController = require('../controllers/index.controller');

const router = express.Router();

router.use(requireGatewayAuth);
router.get('/', indexController.indexPage);

module.exports = router;
