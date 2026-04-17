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

function buildProxyReqPath(appName, req) {
  const originalUrl = String(req.originalUrl || '').trim();
  if (!originalUrl) {
    return originalUrl;
  }

  const canonicalSegment = `/apps/${appName}`;
  if (!originalUrl.includes(canonicalSegment)) {
    return originalUrl;
  }

  return originalUrl.replace(canonicalSegment, `/${appName}`);
}

function rewriteLocationHeader(appName, location) {
  const rawLocation = String(location || '').trim();
  if (!rawLocation) {
    return rawLocation;
  }

  const basePath = String(process.env.BASE_PATH_DEV || '').replace(/\/+$/, '');
  const legacyPrefix = `${basePath}/${appName}`;
  const canonicalPrefix = `${basePath}/apps/${appName}`;

  if (rawLocation.startsWith(legacyPrefix)) {
    return rawLocation.replace(legacyPrefix, canonicalPrefix);
  }

  if (!/^https?:\/\//i.test(rawLocation)) {
    return rawLocation;
  }

  try {
    const parsed = new URL(rawLocation);
    if (parsed.pathname.startsWith(legacyPrefix)) {
      parsed.pathname = parsed.pathname.replace(legacyPrefix, canonicalPrefix);
      return parsed.toString();
    }
    return rawLocation;
  } catch (_error) {
    return rawLocation;
  }
}

function buildProxyOptions(appName) {
  return {
    changeOrigin: true,
    preserveHeaderKeyCase: true,
    filter: (req, res) => {
      return req.method !== 'TRACE';
    },
    proxyReqPathResolver: (req) => {
      return buildProxyReqPath(appName, req);
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      const sessionToken = String(srcReq.accessToken || '').trim();
      if (sessionToken) {
        proxyReqOpts.headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const user = srcReq.authUser;
      if (user) {
        proxyReqOpts.headers['X-Gateway-User-Id'] = String(user.id || '');
        proxyReqOpts.headers['X-Gateway-User-Name'] = String(user.userName || '');
        proxyReqOpts.headers['X-Gateway-User-Email'] = String(user.email || '');
        proxyReqOpts.headers['X-Gateway-User-Role'] = String(user.role || '');
        proxyReqOpts.headers['X-Gateway-User-Role-Id'] = String(user.roleId || '');
      }
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers = {}) => {
      const location = headers.location || headers.Location;
      const rewrittenLocation = rewriteLocationHeader(appName, location);
      if (rewrittenLocation && rewrittenLocation !== location) {
        if (headers.location) {
          headers.location = rewrittenLocation;
        }
        if (headers.Location) {
          headers.Location = rewrittenLocation;
        }
      }
      return headers;
    }
  };
}

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
  // Canonical routes used by desktop links.
  router.use(`/apps/${appName}`, requireAuth, httpProxy(getProxyUrl(appName), buildProxyOptions(appName)));

  // Backward-compatible legacy routes.
  router.use(`/${appName}`, requireAuth, httpProxy(getProxyUrl(appName), buildProxyOptions(appName)));
});

module.exports = router;
