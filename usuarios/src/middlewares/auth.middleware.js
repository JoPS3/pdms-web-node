const axios = require('axios');

function firstHeaderValue(headerValue) {
  return String(headerValue || '')
    .split(',')[0]
    .trim();
}

function parseSessionToken(req) {
  const authorization = String(req.headers.authorization || '').trim();
  if (!authorization) {
    return '';
  }

  const [scheme, token] = authorization.split(' ');
  if (String(scheme || '').toLowerCase() === 'bearer' && String(token || '').trim()) {
    return String(token).trim();
  }

  return '';
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
  const id = String(req.headers['x-gateway-user-id'] || '').trim();
  if (!id) return null;
  return {
    id,
    userName: String(req.headers['x-gateway-user-name'] || '').trim(),
    email: String(req.headers['x-gateway-user-email'] || '').trim(),
    role: String(req.headers['x-gateway-user-role'] || '').trim(),
    roleId: String(req.headers['x-gateway-user-role-id'] || '').trim() || null
  };
}

async function validateGatewaySession(req) {
  const sessionToken = parseSessionToken(req);
  if (!sessionToken) {
    return { valid: false, reason: 'no_token' };
  }

  const gatewayValidateUrl = req.app.get('gatewayValidateUrl');
  const response = await axios.get(gatewayValidateUrl, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    },
    timeout: 5000,
    validateStatus: () => true
  });

  if (!response?.data?.valid) {
    return { valid: false, reason: response?.data?.reason || 'invalid' };
  }

  return { valid: true, user: buildNormalizedUser(response.data) };
}

/**
 * Middleware que valida sessão chamando o gateway
 * Adiciona req.user se válido, redireciona para gateway login se inválido
 */
async function requireGatewayAuth(req, res, next) {
  const gatewayBasePathRaw = String(req.app.get('gatewayBasePath') || '').trim();
  const gatewayPort = Number(req.app.get('gatewayPort')) || 6000;
  const forwardedHost = firstHeaderValue(req.get('x-forwarded-host'));
  const forwardedProto = firstHeaderValue(req.get('x-forwarded-proto'));
  const isProxied = Boolean(forwardedHost || forwardedProto);
  const gatewayBasePath = /^https?:\/\//i.test(gatewayBasePathRaw)
    ? gatewayBasePathRaw.replace(/\/+$/, '')
    : (isProxied
      ? gatewayBasePathRaw.replace(/\/+$/, '')
      : `${req.protocol}://${req.hostname}:${gatewayPort}${gatewayBasePathRaw.replace(/\/+$/, '')}`);

  const sessionToken = parseSessionToken(req);
  if (!sessionToken) {
    return res.redirect(`${gatewayBasePath}/login`);
  }

  // Fast path: gateway injected user context headers
  const user = buildUserFromHeaders(req);
  if (user) {
    req.user = user;
    return next();
  }

  // Fallback: validate via HTTP (acesso direto/inter-serviço)
  try {
    const validation = await validateGatewaySession(req);
    if (!validation.valid) {
      return res.redirect(`${gatewayBasePath}/login`);
    }
    req.user = validation.user;
    return next();
  } catch (error) {
    console.error('[usuarios] Erro ao validar sessão com gateway:', error.message);
    return res.redirect(`${gatewayBasePath}/login`);
  }
}

/**
 * Middleware para APIs internas entre serviços.
 * Aceita apenas Bearer token e devolve JSON em falha.
 */
async function requireGatewaySessionApi(req, res, next) {
  const sessionToken = parseSessionToken(req);
  if (!sessionToken) {
    return res.status(401).json({
      error: 'invalid_gateway_session',
      message: 'Sessao invalida ou expirada no gateway.'
    });
  }

  // Fast path: gateway injected user context headers
  const user = buildUserFromHeaders(req);
  if (user) {
    req.user = user;
    return next();
  }

  // Fallback: validate via HTTP
  try {
    const validation = await validateGatewaySession(req);
    if (!validation.valid) {
      return res.status(401).json({
        error: 'invalid_gateway_session',
        message: 'Sessao invalida ou expirada no gateway.'
      });
    }

    req.user = validation.user;
    return next();
  } catch (error) {
    console.error('[usuarios] Erro API ao validar sessão com gateway:', error.message);
    return res.status(502).json({
      error: 'gateway_validation_unavailable',
      message: 'Nao foi possivel validar sessao no gateway.'
    });
  }
}

module.exports = {
  parseSessionToken,
  validateGatewaySession,
  requireGatewayAuth,
  requireGatewaySessionApi
};
