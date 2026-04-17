const express = require('express');
const httpProxy = require('express-http-proxy');
const { requireAuth } = require('../middlewares/auth.middleware');
const appsController = require('../controllers/apps.controller');

const router = express.Router();

/**
 * Resolves the proxy URL for an app.
 * This is the centralized pattern for all apps (current and future).
 * 
 * Apps should follow this port convention:
 * - mapas: 6002
 * - vendas: 6003
 * - compras: 6004
 * - rh: 6005
 * 
 * @param {string} appName - The app identifier (e.g., 'vendas', 'mapas')
 * @returns {string} - The full URL for the app
 */
const getProxyUrl = (appName) => {
  const isDev = process.env.NODE_ENV === 'development';
  const ports = {
    usuarios: process.env.USUARIOS_PORT_DEV || process.env.USUARIOS_PORT || 6001,
    mapas: process.env.MAPAS_PORT_DEV || 6002,
    vendas: process.env.VENDAS_PORT_DEV || 6003,
    compras: process.env.COMPRAS_PORT_DEV || 6004,
    rh: process.env.RH_PORT_DEV || 6005
  };

  const hostUrls = {
    usuarios: process.env.USUARIOS_URL,
    mapas: process.env.MAPAS_URL,
    vendas: process.env.VENDAS_URL,
    compras: process.env.COMPRAS_URL,
    rh: process.env.RH_URL
  };

  if (isDev || !hostUrls[appName]) {
    return `http://localhost:${ports[appName]}`;
  }

  return hostUrls[appName];
};

const proxyOptions = {
  changeOrigin: true,
  preserveHeaderKeyCase: true,
  filter: (req, res) => {
    return req.method !== 'TRACE';
  }
};

/**
 * ALL APPS ROUTES - Centralized routing for all applications
 * This is the standard pattern for present and future apps.
 * 
 * Route structure:
 * - GET /apps - List all available apps
 * - /usuarios/* - Proxy to usuarios service
 * - /mapas/* - Proxy to mapas service
 * - /vendas/* - Proxy to vendas service
 * - /compras/* - Proxy to compras service
 * - /rh/* - Proxy to rh service
 * 
 * All routes require authentication.
 */

// GET /apps - List all available apps
router.get('/apps', requireAuth, appsController.listApps);

// Proxy routes to apps - all require auth
const apps = ['usuarios', 'mapas', 'vendas', 'compras', 'rh'];
apps.forEach(appName => {
  router.use(`/${appName}`, requireAuth, httpProxy(getProxyUrl(appName), proxyOptions));
});

module.exports = router;
