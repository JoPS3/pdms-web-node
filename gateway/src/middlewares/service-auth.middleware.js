const AuthService = require('../services/AuthService');

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

async function requireServiceSession(req, res, next) {
  // Aceita Bearer (service-to-service) OU token da sessão Express (browser)
  const sessionToken = parseSessionToken(req) || String(req.session?.sessionToken || '').trim();
  if (!sessionToken) {
    return res.status(401).json({ valid: false, reason: 'no_token' });
  }

  try {
    const validation = await AuthService.validateSession(sessionToken);
    if (!validation.valid) {
      return res.status(401).json({ valid: false, reason: validation.reason || 'invalid' });
    }

    req.serviceSessionToken = sessionToken;
    req.serviceUser = {
      id: validation.userId,
      userName: validation.userName,
      email: validation.email,
      roleId: validation.roleId,
      role: validation.role
    };

    return next();
  } catch (error) {
    return res.status(502).json({ valid: false, reason: 'session_validation_unavailable' });
  }
}

module.exports = {
  parseSessionToken,
  requireServiceSession
};
