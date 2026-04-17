const express = require('express');

const authRoutes = require('./auth.routes');
const appProxyRoutes = require('./apps-proxy.routes');
const oneDriveRoutes = require('./onedrive.routes');

const router = express.Router();

/**
 * Centralized route management
 * 
 * All routes are organized by concern:
 * - auth.routes: Authentication endpoints (login, logout, etc)
 * - apps-proxy.routes: All app proxies (mapas, vendas, compras, rh) + apps list
 * - onedrive.routes: OneDrive integration endpoints
 */

router.use(authRoutes);
router.use(appProxyRoutes);
router.use(oneDriveRoutes);

module.exports = router;
