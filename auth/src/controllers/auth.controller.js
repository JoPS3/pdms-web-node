const { hashPassword, verifyPassword } = require('../services/password.service');
const { parseSessionToken } = require('../middlewares/auth.middleware');
const { createPasswordChangeAuditLog, createUserUpdateAuditLog } = require('../services/mapas-audit.service');
const {
  getUserPasswordById,
  updateUserPasswordById
} = require('../services/user-password.service');
const {
  listUsers,
  listActiveUserRoles,
  listUsersWithPagination,
  getUsersTableFilterOptions,
  listUsersForExport,
  getUserByIdForEdit,
  updateUserFromEditById
} = require('../services/users-list.service');

function parseTableFiltersFromQuery(query) {
  const tableFilters = {};
  const tfPattern = /^tf([A-Z][a-zA-Z]*)$/;
  for (const [key, value] of Object.entries(query || {})) {
    const match = key.match(tfPattern);
    if (match) {
      const filterKey = match[1][0].toLowerCase() + match[1].slice(1);
      tableFilters[filterKey] = Array.isArray(value) ? value : [value];
    }
  }
  return tableFilters;
}

function escapeCsvCell(value) {
  const raw = String(value ?? '');
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function createCsv(rows) {
  const header = ['Utilizador', 'Nome', 'Email', 'Perfil', 'Autorizado'];
  const lines = [header.map(escapeCsvCell).join(',')];

  rows.forEach((row) => {
    const values = [
      row.userName || '',
      row.fullName || '',
      row.email || '',
      row.role || '',
      row.isAuthorized ? 'Sim' : 'Nao'
    ];
    lines.push(values.map(escapeCsvCell).join(','));
  });

  return lines.join('\n');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createFlatOdf(rows) {
  const header = ['Utilizador', 'Nome', 'Email', 'Perfil', 'Autorizado'];
  const allRows = [header].concat(
    rows.map((row) => [
      row.userName || '',
      row.fullName || '',
      row.email || '',
      row.role || '',
      row.isAuthorized ? 'Sim' : 'Nao'
    ])
  );

  const xmlRows = allRows.map((cols) => {
    const xmlCols = cols.map((cell) => (
      `<table:table-cell office:value-type="string"><text:p>${escapeXml(cell)}</text:p></table:table-cell>`
    )).join('');
    return `<table:table-row>${xmlCols}</table:table-row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  office:version="1.2"
  office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Utilizadores">
        ${xmlRows}
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document>`;
}

async function getHomePage(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.max(10, Math.min(Number(req.query.pageSize) || 50, 200));
  const sortBy = req.query.sortBy || 'userName';
  const sortDir = req.query.sortDir || 'ASC';

  const tableFilters = parseTableFiltersFromQuery(req.query);

  let usersData = { rows: [], pagination: {}, sortBy, sortDir };
  let tableFilterOptions = {};
  let userRoleOptions = [];

  try {
    usersData = await listUsersWithPagination(page, pageSize, tableFilters, sortBy, sortDir);
    tableFilterOptions = await getUsersTableFilterOptions(tableFilters);
    userRoleOptions = await listActiveUserRoles();
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
    userRoleOptions,
    pagination: usersData.pagination,
    tableFilters,
    tableFilterOptions,
    sortBy: usersData.sortBy,
    sortDir: usersData.sortDir
  });
}

async function exportUsersList(req, res) {
  const sortBy = req.query.sortBy || 'userName';
  const sortDir = req.query.sortDir || 'ASC';
  const format = String(req.query.format || 'csv').toLowerCase();
  const tableFilters = parseTableFiltersFromQuery(req.query);

  try {
    const result = await listUsersForExport(tableFilters, sortBy, sortDir);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'odf') {
      const body = createFlatOdf(result.rows);
      res.setHeader('Content-Type', 'application/vnd.oasis.opendocument.spreadsheet; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="auth-utilizadores-filtrados-${stamp}.fods"`);
      res.status(200).send(body);
      return;
    }

    const body = createCsv(result.rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="auth-utilizadores-filtrados-${stamp}.csv"`);
    res.status(200).send(body);
  } catch (error) {
    console.error('[auth] Erro ao exportar utilizadores filtrados:', error.message);
    res.status(500).json({
      error: 'export_failed',
      message: 'Nao foi possivel exportar a listagem filtrada.'
    });
  }
}

async function getEditUserPage(req, res) {
  const userId = String(req.params.userId || '').trim();
  if (!userId) {
    return res.status(400).render('error', {
      title: 'Erro',
      error: 'Identificador de utilizador invalido.'
    });
  }

  try {
    const userToEdit = await getUserByIdForEdit(userId);
    if (!userToEdit) {
      return res.status(404).render('404', { title: 'Not Found' });
    }

    return res.status(200).render('user-edit', {
      pageTitle: 'Editar Utilizador',
      userName: req.user?.userName || 'Utilizador',
      userRole: req.user?.role || '',
      userId: req.user?.id || '',
      userToEdit
    });
  } catch (error) {
    console.error('[auth] Erro ao abrir view de edicao de utilizador:', error.message);
    return res.status(500).render('error', {
      title: 'Erro',
      error: 'Nao foi possivel abrir a view de edicao do utilizador.'
    });
  }
}

async function updateUserFromEdit(req, res) {
  const targetUserId = String(req.params.userId || '').trim();
  const sessionToken = parseSessionToken(req);
  const actor = req.user?.userName || req.user?.email || 'system@pedaco.pt';
  const actorRole = req.user?.role || null;
  const mapasAuditLogUrl = req.app?.get('mapasAuditLogUrl')
    || process.env.MAPAS_AUDIT_LOG_URL
    || (process.env.NODE_ENV === 'development'
      ? 'http://localhost:6001/pdms-new/mapas/internal/auditoria/log'
      : 'http://localhost:6001/pdms/mapas/internal/auditoria/log');

  if (!targetUserId) {
    return res.status(400).json({
      error: 'invalid_user_id',
      message: 'Identificador de utilizador invalido.'
    });
  }

  try {
    const before = await getUserByIdForEdit(targetUserId);
    if (!before) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'Utilizador nao encontrado.'
      });
    }

    const updateResult = await updateUserFromEditById(targetUserId, req.body || {}, actor);
    if (!updateResult.ok) {
      if (updateResult.error === 'duplicate_user_name') {
        return res.status(409).json({
          error: 'duplicate_user_name',
          message: 'Ja existe outro utilizador com esse nome de utilizador.'
        });
      }
      if (updateResult.error === 'duplicate_email') {
        return res.status(409).json({
          error: 'duplicate_email',
          message: 'Ja existe outro utilizador com esse email.'
        });
      }
      if (updateResult.error === 'invalid_role') {
        return res.status(400).json({
          error: 'invalid_role',
          message: 'Perfil selecionado e invalido.'
        });
      }
      if (updateResult.error === 'missing_required_fields') {
        return res.status(400).json({
          error: 'missing_required_fields',
          message: 'Existem campos obrigatorios em falta.'
        });
      }
      return res.status(404).json({
        error: 'user_not_found',
        message: 'Utilizador nao encontrado.'
      });
    }

    const after = await getUserByIdForEdit(targetUserId);
    const changedFields = [];
    if (after) {
      if (before.userName !== after.userName) changedFields.push('user_name');
      if (before.fullName !== after.fullName) changedFields.push('full_name');
      if (before.email !== after.email) changedFields.push('email');
      if (before.roleId !== after.roleId) changedFields.push('role_id');
      if (before.isAuthorized !== after.isAuthorized) changedFields.push('is_authorized');
      if (before.hasPassword !== after.hasPassword) changedFields.push('password');
    }

    try {
      await createUserUpdateAuditLog({
        auditLogUrl: mapasAuditLogUrl,
        sessionToken,
        targetUserId,
        targetUserName: after?.userName || before.userName,
        actor,
        actorRole,
        changedFields
      });

      return res.status(200).json({
        status: 'ok',
        auditStatus: 'ok',
        message: 'Utilizador atualizado com sucesso.'
      });
    } catch (auditError) {
      console.error('[auth] Utilizador atualizado mas auditoria falhou:', auditError.message);
      return res.status(200).json({
        status: 'ok',
        auditStatus: 'failed',
        message: 'Utilizador atualizado com sucesso, mas o registo de auditoria falhou.'
      });
    }
  } catch (error) {
    console.error('[auth] Erro ao atualizar utilizador:', error.message);
    return res.status(500).json({
      error: 'user_update_failed',
      message: 'Erro interno ao atualizar utilizador.'
    });
  }
}

function getSessionStatus(req, res) {
  if (!req.user) {
    return res.status(401).json({
      status: 'unauthorized',
      session: {
        valid: false,
        message: 'Token ausente ou inválido'
      },
      timestamp: new Date().toISOString()
    });
  }

  return res.status(200).json({
    status: 'ok',
    session: {
      valid: true,
      userId: req.user?.id || null,
      userName: req.user?.userName || null,
      email: req.user?.email || null,
      role: req.user?.role || null,
      roleId: req.user?.roleId || null
    },
    timestamp: new Date().toISOString()
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
  getSessionStatus,
  getInternalSessionStatus,
  changeInternalSessionPassword,
  exportUsersList,
  getEditUserPage,
  updateUserFromEdit
};
