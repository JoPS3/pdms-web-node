const { hashPassword, verifyPassword } = require('../services/password.service');
const { parseSessionToken } = require('../middlewares/auth.middleware');
const { createPasswordChangeAuditLog } = require('../services/mapas-audit.service');
const {
  getUserPasswordById,
  updateUserPasswordById
} = require('../services/user-password.service');
const {
  listUsers,
  listUsersWithPagination,
  getUsersTableFilterOptions
} = require('../services/users-list.service');

async function getHomePage(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.max(10, Math.min(Number(req.query.pageSize) || 50, 200));
  const sortBy = req.query.sortBy || 'userName';
  const sortDir = req.query.sortDir || 'ASC';

  // Parse table filters from query params (tf* pattern)
  const tableFilters = {};
  const tfPattern = /^tf([A-Z][a-zA-Z]*)$/;
  for (const [key, value] of Object.entries(req.query)) {
    const match = key.match(tfPattern);
    if (match) {
      const filterKey = match[1][0].toLowerCase() + match[1].slice(1);
      tableFilters[filterKey] = Array.isArray(value) ? value : [value];
    }
  }

  let usersData = { rows: [], pagination: {}, sortBy, sortDir };
  let tableFilterOptions = {};

  try {
    usersData = await listUsersWithPagination(page, pageSize, tableFilters, sortBy, sortDir);
    tableFilterOptions = await getUsersTableFilterOptions(tableFilters);
  } catch (error) {
    console.error('[auth] Erro ao obter lista de utilizadores:', error.message);
    // Fallback to empty list
    usersData = {
      rows: [],
      pagination: { currentPage: 1, pageSize: 50, totalRecords: 0, totalPages: 1, from: 0, to: 0 },
      sortBy,
      sortDir
    };
  }

  res.status(200).render('index', {
    pageTitle: 'Auth',
    userName: req.user?.userName || 'Utilizador',
    userRole: req.user?.role || '',
    userId: req.user?.id || '',
    session: {
      userId: req.user?.id || null,
      userName: req.user?.userName || null,
      email: req.user?.email || null,
      role: req.user?.role || null,
      roleId: req.user?.roleId || null
    },
    usersList: usersData.rows,
    pagination: usersData.pagination,
    tableFilters,
    tableFilterOptions,
    sortBy: usersData.sortBy,
    sortDir: usersData.sortDir
  });
}

function getInternalSessionStatus(req, res) {
  return res.status(200).json({
    status: 'ok',
    session: {
      valid: true,
      userId: req.user?.id || null,
      userName: req.user?.userName || null,
      role: req.user?.role || null
    },
    timestamp: new Date().toISOString()
  });
}

async function changeInternalSessionPassword(req, res) {
  const userId = req.user?.id;
  const changedBy = req.user?.userName || req.user?.email || 'system@pedaco.pt';
  const sessionToken = parseSessionToken(req);
  const mapasAuditLogUrl = req.app?.get('mapasAuditLogUrl')
    || process.env.MAPAS_AUDIT_LOG_URL
    || (process.env.NODE_ENV === 'development'
      ? 'http://localhost:6001/pdms-new/mapas/internal/auditoria/log'
      : 'http://localhost:6001/pdms/mapas/internal/auditoria/log');
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!userId) {
    return res.status(401).json({
      error: 'missing_session_user',
      message: 'Sessao invalida para alteracao de password.'
    });
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      error: 'invalid_new_password',
      message: 'A nova password deve ter pelo menos 8 caracteres.'
    });
  }

  if (newPassword.length > 128) {
    return res.status(400).json({
      error: 'invalid_new_password',
      message: 'A nova password excede o tamanho maximo permitido.'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      error: 'password_confirmation_mismatch',
      message: 'A confirmacao da password nao coincide.'
    });
  }

  if (currentPassword && currentPassword === newPassword) {
    return res.status(400).json({
      error: 'same_password',
      message: 'A nova password deve ser diferente da atual.'
    });
  }

  try {
    const user = await getUserPasswordById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'Utilizador nao encontrado.'
      });
    }

    const existingHash = String(user.password || '');
    if (existingHash) {
      if (!currentPassword) {
        return res.status(400).json({
          error: 'current_password_required',
          message: 'A password atual e obrigatoria.'
        });
      }

      const validCurrentPassword = await verifyPassword(currentPassword, existingHash);
      if (!validCurrentPassword) {
        return res.status(401).json({
          error: 'invalid_current_password',
          message: 'A password atual esta incorreta.'
        });
      }
    }

    const newHash = await hashPassword(newPassword);
    const updatedRows = await updateUserPasswordById(userId, newHash, changedBy);
    if (!updatedRows) {
      return res.status(500).json({
        error: 'password_not_updated',
        message: 'Nao foi possivel atualizar a password.'
      });
    }

    try {
      await createPasswordChangeAuditLog({
        auditLogUrl: mapasAuditLogUrl,
        sessionToken,
        targetUserId: userId,
        targetUserName: req.user?.userName || null,
        actor: changedBy,
        actorRole: req.user?.role || null
      });

      return res.status(200).json({
        status: 'ok',
        auditStatus: 'ok',
        message: 'Password alterada com sucesso.'
      });
    } catch (auditError) {
      console.error('[auth] Password alterada mas auditoria falhou:', auditError.message);
      return res.status(200).json({
        status: 'ok',
        auditStatus: 'failed',
        message: 'Password alterada com sucesso, mas o registo de auditoria falhou.'
      });
    }
  } catch (error) {
    console.error('[auth] Erro ao alterar password:', error.message);
    return res.status(500).json({
      error: 'password_change_failed',
      message: 'Erro interno ao alterar password.'
    });
  }
}

module.exports = {
  getHomePage,
  getInternalSessionStatus,
  changeInternalSessionPassword
};
