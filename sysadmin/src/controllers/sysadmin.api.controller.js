const { hashPassword, verifyPassword } = require('../services/password.service');
const { parseSessionToken } = require('../middlewares/session.middleware');
const { createPasswordChangeAuditLog } = require('../services/mapas-audit.service');
const {
  getUserPasswordById,
  updateUserPasswordById
} = require('../services/user-password.service');

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
      ? 'http://localhost:6002/pdms-new/mapas/internal/auditoria/log'
      : 'http://localhost:6002/pdms/mapas/internal/auditoria/log');
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
      console.error('[sysadmin] Password alterada mas auditoria falhou:', auditError.message);
      return res.status(200).json({
        status: 'ok',
        auditStatus: 'failed',
        message: 'Password alterada com sucesso, mas o registo de auditoria falhou.'
      });
    }
  } catch (error) {
    console.error('[sysadmin] Erro ao alterar password:', error.message);
    return res.status(500).json({
      error: 'password_change_failed',
      message: 'Erro interno ao alterar password.'
    });
  }
}

module.exports = {
  getSessionStatus,
  getInternalSessionStatus,
  changeInternalSessionPassword
};
