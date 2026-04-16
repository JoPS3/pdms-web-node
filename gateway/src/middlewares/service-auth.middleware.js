const AuthService = require('../services/AuthService');

function parseSessionToken(req) {
  const cookieToken = String(req.cookies?.session_token || '').trim();
  if (cookieToken) {
    return cookieToken;
  }

  const headerToken = String(req.headers['x-session-token'] || '').trim();
  if (headerToken) {
    return headerToken;
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

async function requireServiceSession(req, res, next) {
  const sessionToken = parseSessionToken(req);
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
