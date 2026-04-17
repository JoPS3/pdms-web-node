const { basePath } = require('../config/runtime');
const AuthService = require('../services/AuthService');

function parseBearerToken(req) {
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

/**
 * Middleware de autenticação obrigatória
 * Aceita sessão Express OU Bearer token (Phase 2: stateless)
 * Se não estiver autenticado, redireciona para /login
 */
async function requireAuth(req, res, next) {
  const bearerToken = parseBearerToken(req);
  const sessionToken = String(req.session?.sessionToken || '').trim() || bearerToken;

  if (!sessionToken) {
    return res.redirect(`${basePath}/login`);
  }

  try {
    const result = await AuthService.validateSession(sessionToken);

    if (!result.valid) {
      if (req.session) req.session.destroy(() => {});
      return res.redirect(`${basePath}/login`);
    }

    // Popula req.session.user para uso downstream (headers de proxy, etc.)
    req.session.user = {
      id: result.userId,
      userName: result.userName,
      email: result.email,
      roleId: result.roleId,
      role: result.role
    };
    req.session.sessionToken = sessionToken;

    return next();
  } catch (error) {
    console.error('Erro ao validar sessão no middleware:', error);
    if (req.session) req.session.destroy(() => {});
    return res.redirect(`${basePath}/login`);
  }
}

/**
 * Middleware para validar role específico
 * Uso: requireRole('admin') protege rota apenas para admins
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Aqui iria buscar nome do role_id da BD
    // Por enquanto, deixamos apenas verificar que roleId existe
    if (!req.session.user.roleId) {
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
