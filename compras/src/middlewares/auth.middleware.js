const axios = require('axios');

function firstHeaderValue(headerValue) {
  return String(headerValue || '')
    .split(',')[0]
    .trim();
}

function parseSessionToken(req) {
  const cookieToken = String(req.cookies?.session_token || req.cookies?.sessionId || '').trim();
  if (cookieToken) {
    return cookieToken;
  }

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

async function validateGatewaySession(req) {
  const sessionToken = parseSessionToken(req);
  if (!sessionToken) {
    return { valid: false, reason: 'no_token' };
  }

  const gatewayValidateUrl = req.app.get('gatewayValidateUrl');
  const response = await axios.get(gatewayValidateUrl, {
    headers: { Cookie: `session_token=${sessionToken}` },
    timeout: 5000,
    validateStatus: () => true
  });

  if (!response?.data?.valid) {
    return { valid: false, reason: response?.data?.reason || 'invalid' };
  }

  return { valid: true, user: buildNormalizedUser(response.data) };
}

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

  try {
    const validation = await validateGatewaySession(req);
    if (!validation.valid) {
      res.clearCookie('session_token');
      res.clearCookie('sessionId');
      return res.redirect(`${gatewayBasePath}/login`);
    }

    req.user = validation.user;
    return next();
  } catch (error) {
    console.error('[compras] Erro ao validar sessao com gateway:', error.message);
    res.clearCookie('session_token');
    res.clearCookie('sessionId');
    return res.redirect(`${gatewayBasePath}/login`);
  }
}

module.exports = {
  requireGatewayAuth
};
