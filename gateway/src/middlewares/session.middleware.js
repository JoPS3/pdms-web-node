const { basePath } = require('../config/runtime');
const AuthService = require('../services/auth.service');
const {
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies
} = require('../utils/authTokens');

/**
 * Middleware de autenticação obrigatória
 * Aceita sessão Express OU Bearer token (Phase 2: stateless)
 * Se não estiver autenticado, redireciona para /login
 */
async function requireAuth(req, res, next) {
  const sessionToken = getAccessToken(req);
  const refreshToken = getRefreshToken(req);

  if (!sessionToken) {
    clearAuthCookies(req, res);
    return res.redirect(`${basePath}/login`);
  }

  try {
    let result = await AuthService.validateSession(sessionToken);
    let effectiveAccessToken = sessionToken;

    if (!result.valid && refreshToken) {
      const refreshResult = await AuthService.refreshTokens(
        refreshToken,
        req.ip,
        req.get('user-agent')
      );

      if (!refreshResult.error) {
        effectiveAccessToken = refreshResult.accessToken;
        result = await AuthService.validateSession(effectiveAccessToken);
        if (result.valid) {
          setAuthCookies(req, res, refreshResult.accessToken, refreshResult.refreshToken);
          res.set('x-access-token', refreshResult.accessToken);
          res.set('x-refresh-token', refreshResult.refreshToken);
        }
      }
    }

    if (!result.valid) {
      clearAuthCookies(req, res);
      return res.redirect(`${basePath}/login`);
    }

    req.authUser = {
      id: result.userId,
      userName: result.userName,
      email: result.email,
      roleId: result.roleId,
      role: result.role
    };
    req.accessToken = effectiveAccessToken;

    return next();
  } catch (error) {
    console.error('Erro ao validar sessão no middleware:', error);
    clearAuthCookies(req, res);
    return res.redirect(`${basePath}/login`);
  }
}

/**
 * Middleware para validar role específico
 * Uso: requireRole('admin') protege rota apenas para admins
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Aqui iria buscar nome do role_id da BD
    // Por enquanto, deixamos apenas verificar que roleId existe
    if (!req.authUser.roleId) {
      return res.status(403).json({ error: 'No role assigned' });
    }

    // TODO: adicionar verificação real do role
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
