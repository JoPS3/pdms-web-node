const axios = require('axios');

function firstHeaderValue(headerValue) {
  return String(headerValue || '')
    .split(',')[0]
    .trim();
}

function parseSessionToken(req) {
  const authorization = String(req.headers?.authorization || '').trim();
  if (!authorization) {
    return String(req.cookies?.pdms_access_token || '').trim();
  }

  const [scheme, token] = authorization.split(' ');
  if (String(scheme || '').toLowerCase() === 'bearer' && String(token || '').trim()) {
    return String(token).trim();
  }

  return String(req.cookies?.pdms_access_token || '').trim();
}

function parseRefreshToken(req) {
  return String(req.headers?.['x-refresh-token'] || '').trim()
    || String(req.cookies?.pdms_refresh_token || '').trim();
}

function buildNormalizedUser(payload = {}) {
  return {
    id: payload.userId,
    userName: payload.userName,
    email: payload.email,
    roleId: payload.roleId,
    role: payload.role
  };
}

function buildUserFromHeaders(req) {
  const id = String(req.headers?.['x-gateway-user-id'] || '').trim();
  if (!id) {
    return null;
  }

  return {
    id,
    userName: String(req.headers?.['x-gateway-user-name'] || '').trim(),
    email: String(req.headers?.['x-gateway-user-email'] || '').trim(),
    role: String(req.headers?.['x-gateway-user-role'] || '').trim(),
    roleId: String(req.headers?.['x-gateway-user-role-id'] || '').trim() || null
  };
}

function resolveGatewayBasePath(req) {
  const gatewayBasePathRaw = String(req.app.get('gatewayBasePath') || '').trim();
  const gatewayPort = Number(req.app.get('gatewayPort')) || 6000;
  const forwardedHost = firstHeaderValue(req.get('x-forwarded-host'));
  const forwardedProto = firstHeaderValue(req.get('x-forwarded-proto'));
  const isProxied = Boolean(forwardedHost || forwardedProto);

  if (/^https?:\/\//i.test(gatewayBasePathRaw)) {
    return gatewayBasePathRaw.replace(/\/+$/, '');
  }

  if (isProxied) {
    return gatewayBasePathRaw.replace(/\/+$/, '');
  }

  return `${req.protocol}://${req.hostname}:${gatewayPort}${gatewayBasePathRaw.replace(/\/+$/, '')}`;
}

async function validateGatewaySession(req, options = {}) {
  const sessionToken = parseSessionToken(req);
  if (!sessionToken) {
    return { valid: false, reason: 'no_token' };
  }

  const allowRefreshHeader = options.allowRefreshHeader !== false;
  const refreshToken = allowRefreshHeader ? parseRefreshToken(req) : '';
  const gatewayValidateUrl = req.app.get('gatewayValidateUrl');
  const response = await axios.get(gatewayValidateUrl, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {})
    },
    timeout: 5000,
    validateStatus: () => true
  });

  if (!response?.data?.valid) {
    return { valid: false, reason: response?.data?.reason || 'invalid' };
  }

  return { valid: true, user: buildNormalizedUser(response.data) };
}

function createRequireGatewayAuth(moduleName, options = {}) {
  const allowRefreshHeader = options.allowRefreshHeader !== false;

  return async function requireGatewayAuth(req, res, next) {
    const gatewayBasePath = resolveGatewayBasePath(req);
    const sessionToken = parseSessionToken(req);
    if (!sessionToken) {
      return res.redirect(`${gatewayBasePath}/login`);
    }

    const user = buildUserFromHeaders(req);
    if (user) {
      req.user = user;
      return next();
    }

    try {
      const validation = await validateGatewaySession(req, { allowRefreshHeader });
      if (!validation.valid) {
        return res.redirect(`${gatewayBasePath}/login`);
      }
      req.user = validation.user;
      return next();
    } catch (error) {
      console.error(`[${moduleName}] Erro ao validar sessao com gateway:`, error.message);
      return res.redirect(`${gatewayBasePath}/login`);
    }
  };
}

function createRequireGatewaySessionApi(moduleName, options = {}) {
  const allowRefreshHeader = options.allowRefreshHeader !== false;

  return async function requireGatewaySessionApi(req, res, next) {
    const sessionToken = parseSessionToken(req);
    if (!sessionToken) {
      return res.status(401).json({
        error: 'invalid_gateway_session',
        message: 'Sessao invalida ou expirada no gateway.'
      });
    }

    const user = buildUserFromHeaders(req);
    if (user) {
      req.user = user;
      return next();
    }

    try {
      const validation = await validateGatewaySession(req, { allowRefreshHeader });
      if (!validation.valid) {
        return res.status(401).json({
          error: 'invalid_gateway_session',
          message: 'Sessao invalida ou expirada no gateway.'
        });
      }

      req.user = validation.user;
      return next();
    } catch (error) {
      console.error(`[${moduleName}] Erro API ao validar sessao com gateway:`, error.message);
      return res.status(502).json({
        error: 'gateway_validation_unavailable',
        message: 'Nao foi possivel validar sessao no gateway.'
      });
    }
  };
}

module.exports = {
  parseSessionToken,
  parseRefreshToken,
  buildUserFromHeaders,
  validateGatewaySession,
  createRequireGatewayAuth,
  createRequireGatewaySessionApi
};