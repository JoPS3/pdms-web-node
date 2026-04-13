const { basePath } = require('../config/runtime');
const AuthService = require('../services/AuthService');

/**
 * Middleware de autenticação obrigatória
 * Verifica se utilizador está autenticado (session + cookie válido)
 * Se não estiver, redireciona para /login
 */
async function requireAuth(req, res, next) {
  // Se não tem session do utilizador, redireciona
  if (!req.session.user) {
    return res.redirect(`${basePath}/login`);
  }

  // Valida cookie de session token
  const sessionToken = req.cookies.session_token;

  if (!sessionToken) {
    // Limpa session se não tem token
    req.session.destroy(() => {});
    return res.redirect(`${basePath}/login`);
  }

  try {
    // Valida token em BD
    const result = await AuthService.validateSession(sessionToken);

    if (!result.valid) {
      // Limpa session se token não é válido
      req.session.destroy(() => {});
      res.clearCookie('session_token');
      return res.redirect(`${basePath}/login`);
    }

    // Atualiza session data com dados do BD (garante sincronização)
    req.session.user = {
      id: result.userId,
      userName: result.userName,
      email: result.email,
      roleId: result.roleId,
      role: result.role
    };

    return next();
  } catch (error) {
    console.error('Erro ao validar sessão no middleware:', error);
    req.session.destroy(() => {});
    res.clearCookie('session_token');
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
