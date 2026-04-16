const express = require('express');
const httpProxy = require('express-http-proxy');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

const getProxyUrl = (appName) => {
  const isDev = process.env.NODE_ENV === 'development';
  const ports = {
    vendas: process.env.VENDAS_PORT_DEV || 6003,
    compras: process.env.COMPRAS_PORT_DEV || 6004,
    rh: process.env.RH_PORT_DEV || 6005
  };

  if (isDev || !process.env[`${appName.toUpperCase()}_URL`]) {
    return `http://localhost:${ports[appName]}`;
  }

  return process.env[`${appName.toUpperCase()}_URL`];
};

const proxyOptions = {
  changeOrigin: true,
  preserveHeaderKeyCase: true,
  filter: (req, res) => {
    return req.method !== 'TRACE';
  }
};

// Proxy routes to apps
router.use('/vendas', requireAuth, httpProxy(getProxyUrl('vendas'), proxyOptions));
router.use('/compras', requireAuth, httpProxy(getProxyUrl('compras'), proxyOptions));
router.use('/rh', requireAuth, httpProxy(getProxyUrl('rh'), proxyOptions));

module.exports = router;
