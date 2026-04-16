const express = require('express');

const authRoutes = require('./auth.routes');
const appsRoutes = require('./apps.routes');
const appProxyRoutes = require('./apps-proxy.routes');
const oneDriveRoutes = require('./onedrive.routes');

const router = express.Router();

router.use(authRoutes); // inclui GET /validate-session
router.use('/apps', appsRoutes);
router.use(appProxyRoutes); // proxy routes to vendas, compras, rh
router.use(oneDriveRoutes);

module.exports = router;
