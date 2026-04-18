const usersDAO = require('../daos/users.dao');

function mapUserRow(row) {
  return {
    id: row.id,
    userName: row.userName || '',
    fullName: row.fullName || '',
    email: row.email || '',
    roleId: row.roleId || null,
    role: row.role || '',
    isAuthorized: Boolean(row.isAuthorized),
    createdAt: row.createdAt || null
  };
}

function mapEditUserRow(row) {
  return {
    id: row.id,
    userName: row.userName || '',
    firstName: row.firstName || '',
    lastName: row.lastName || '',
    fullName: row.fullName || '',
    email: row.email || '',
    roleId: row.roleId || null,
    role: row.role || '',
    isAuthorized: Boolean(row.isAuthorized),
    hasPassword: Boolean(row.hasPassword),
    createdAt: row.createdAt || null,
    changedAt: row.changedAt || null,
    changedBy: row.changedBy || ''
  };
}

async function listUsers(limit = 100) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 500)) : 100;
  const rows = await usersDAO.listUsers(safeLimit);
  return rows.map(mapUserRow);
}

async function listActiveUserRoles() {
  const rows = await usersDAO.listActiveUserRoles();
  return rows.map((row) => ({
    id: row.id,
    role: row.role || ''
  }));
}

async function getUserByIdForEdit(userId) {
  const row = await usersDAO.findUserByIdForEdit(userId);
  if (!row) return null;

  return mapEditUserRow(row);
}

async function updateUserFromEditById(userId, payload = {}, changedBy = 'system@pedaco.pt') {
  const safeUserId = String(userId || '').trim();
  const safeUserName = String(payload.userName || '').trim();
  const safeEmail = String(payload.email || '').trim().toLowerCase();
  const safeRoleId = String(payload.roleId || '').trim();
  const safeIsAuthorized = payload.isAuthorized === true || payload.isAuthorized === 'true' ? 1 : 0;
  const safeClearPassword = payload.clearPassword === true || payload.clearPassword === 'true' ? 1 : 0;
  const safeFullName = String(payload.fullName || '').trim();

  if (!safeUserId || !safeUserName || !safeEmail || !safeRoleId || !safeFullName) {
    return { ok: false, error: 'missing_required_fields' };
  }

  const role = await usersDAO.findRoleById(safeRoleId);
  if (!role) {
    return { ok: false, error: 'invalid_role' };
  }

  const userNameConflict = await usersDAO.findUserNameConflict(safeUserName, safeUserId);
  if (userNameConflict) {
    return { ok: false, error: 'duplicate_user_name' };
  }

  const emailConflict = await usersDAO.findEmailConflict(safeEmail, safeUserId);
  if (emailConflict) {
    return { ok: false, error: 'duplicate_email' };
  }

  const nameParts = safeFullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || safeFullName;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  const result = await usersDAO.updateUserById({
    userId: safeUserId,
    roleId: safeRoleId,
    firstName,
    lastName: lastName || null,
    userName: safeUserName,
    email: safeEmail,
    isAuthorized: safeIsAuthorized,
    clearPassword: safeClearPassword,
    changedBy
  });

  return {
    ok: Boolean(result.affectedRows),
    error: result.affectedRows ? null : 'not_found'
  };
}

module.exports = {
  mapUserRow,
  listUsers,
  listActiveUserRoles,
  getUserByIdForEdit,
  updateUserFromEditById
};
