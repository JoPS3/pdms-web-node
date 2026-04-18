const { parseSessionToken } = require('../middlewares/session.middleware');
const { createUserUpdateAuditLog } = require('../services/mapas-audit.service');
const {
  getUserByIdForEdit,
  updateUserFromEditById
} = require('../services/users.service');

async function updateUserFromEdit(req, res) {
  const targetUserId = String(req.params.userId || '').trim();
  const sessionToken = parseSessionToken(req);
  const actor = req.user?.userName || req.user?.email || 'system@pedaco.pt';
  const actorRole = req.user?.role || null;
  const mapasAuditLogUrl = req.app?.get('mapasAuditLogUrl')
    || process.env.MAPAS_AUDIT_LOG_URL
    || (process.env.NODE_ENV === 'development'
      ? 'http://localhost:6002/pdms-new/mapas/internal/auditoria/log'
      : 'http://localhost:6002/pdms/mapas/internal/auditoria/log');

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
      console.error('[sysadmin] Utilizador atualizado mas auditoria falhou:', auditError.message);
      return res.status(200).json({
        status: 'ok',
        auditStatus: 'failed',
        message: 'Utilizador atualizado com sucesso, mas o registo de auditoria falhou.'
      });
    }
  } catch (error) {
    console.error('[sysadmin] Erro ao atualizar utilizador:', error.message);
    return res.status(500).json({
      error: 'user_update_failed',
      message: 'Erro interno ao atualizar utilizador.'
    });
  }
}

module.exports = {
  updateUserFromEdit
};
