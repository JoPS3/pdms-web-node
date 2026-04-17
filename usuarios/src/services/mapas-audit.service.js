const axios = require('axios');

async function createPasswordChangeAuditLog({
  auditLogUrl,
  sessionToken,
  targetUserId,
  targetUserName,
  actor,
  actorRole
}) {
  if (!auditLogUrl) {
    throw new Error('MAPAS_AUDIT_LOG_URL nao configurado.');
  }

  if (!sessionToken) {
    throw new Error('Session token em falta para auditoria.');
  }

  if (!targetUserId) {
    throw new Error('targetUserId e obrigatorio para auditoria.');
  }

  const response = await axios.post(
    auditLogUrl,
    {
      action: 'CHANGE_PASSWORD',
      tableName: 'users',
      recordId: targetUserId,
      meta: {
        module: 'auth',
        feature: 'session-password-change',
        targetUserName: targetUserName || null,
        actor: actor || null,
        actorRole: actorRole || null
      }
    },
    {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      },
      timeout: 5000,
      validateStatus: () => true
    }
  );

  if (response.status < 200 || response.status >= 300 || response.data?.status !== 'ok') {
    throw new Error(response.data?.message || 'Falha ao registar auditoria no modulo mapas.');
  }

  return response.data?.data || null;
}

module.exports = {
  createPasswordChangeAuditLog,
  createUserUpdateAuditLog
};

async function createUserUpdateAuditLog({
  auditLogUrl,
  sessionToken,
  targetUserId,
  targetUserName,
  actor,
  actorRole,
  changedFields = []
}) {
  if (!auditLogUrl) {
    throw new Error('MAPAS_AUDIT_LOG_URL nao configurado.');
  }

  if (!sessionToken) {
    throw new Error('Session token em falta para auditoria.');
  }

  if (!targetUserId) {
    throw new Error('targetUserId e obrigatorio para auditoria.');
  }

  const response = await axios.post(
    auditLogUrl,
    {
      action: 'UPDATE_USER',
      tableName: 'users',
      recordId: targetUserId,
      meta: {
        module: 'auth',
        feature: 'users-edit-window',
        targetUserName: targetUserName || null,
        actor: actor || null,
        actorRole: actorRole || null,
        changedFields: Array.isArray(changedFields) ? changedFields : []
      }
    },
    {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      },
      timeout: 5000,
      validateStatus: () => true
    }
  );

  if (response.status < 200 || response.status >= 300 || response.data?.status !== 'ok') {
    throw new Error(response.data?.message || 'Falha ao registar auditoria no modulo mapas.');
  }

  return response.data?.data || null;
}
