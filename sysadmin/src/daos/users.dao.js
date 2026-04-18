const { query } = require('../db/mysql');

async function listUsers(limit) {
  return query(
    `
      SELECT
        u.id,
        u.user_name AS userName,
        CONCAT_WS(' ', u.first_name, u.last_name) AS fullName,
        u.email,
        ur.id AS roleId,
        ur.role,
        u.is_authorized AS isAuthorized,
        u.created_at AS createdAt
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE u.is_deleted = 0
      ORDER BY u.user_name ASC
      LIMIT ${limit}
    `
  );
}

async function listActiveUserRoles() {
  return query(
    `
      SELECT id, role
      FROM users_role
      WHERE is_deleted = 0
      ORDER BY role ASC
    `
  );
}

async function findUserByIdForEdit(userId) {
  const rows = await query(
    `
      SELECT
        u.id,
        u.user_name AS userName,
        u.first_name AS firstName,
        u.last_name AS lastName,
        CONCAT_WS(' ', u.first_name, u.last_name) AS fullName,
        u.email,
        ur.id AS roleId,
        ur.role AS role,
        u.is_authorized AS isAuthorized,
        CASE WHEN u.password IS NULL OR u.password = '' THEN 0 ELSE 1 END AS hasPassword,
        u.created_at AS createdAt,
        u.changed_at AS changedAt,
        u.changed_by AS changedBy
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE u.id = ?
        AND u.is_deleted = 0
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function findRoleById(roleId) {
  const rows = await query(
    `
      SELECT id
      FROM users_role
      WHERE id = ?
        AND is_deleted = 0
      LIMIT 1
    `,
    [roleId]
  );

  return rows[0] || null;
}

async function findUserNameConflict(userName, userId) {
  const rows = await query(
    `
      SELECT id
      FROM users
      WHERE user_name = ?
        AND id <> ?
        AND is_deleted = 0
      LIMIT 1
    `,
    [userName, userId]
  );

  return rows[0] || null;
}

async function findEmailConflict(email, userId) {
  const rows = await query(
    `
      SELECT id
      FROM users
      WHERE email = ?
        AND id <> ?
        AND is_deleted = 0
      LIMIT 1
    `,
    [email, userId]
  );

  return rows[0] || null;
}

async function updateUserById({
  userId,
  roleId,
  firstName,
  lastName,
  userName,
  email,
  isAuthorized,
  clearPassword,
  changedBy
}) {
  return query(
    `
      UPDATE users
      SET role_id = ?,
          first_name = ?,
          last_name = ?,
          user_name = ?,
          email = ?,
          is_authorized = ?,
          password = IF(?, NULL, password),
          changed_by = ?
      WHERE id = ?
        AND is_deleted = 0
    `,
    [
      roleId,
      firstName,
      lastName,
      userName,
      email,
      isAuthorized,
      clearPassword,
      changedBy,
      userId
    ]
  );
}

async function countUsersByWhere(whereClause, params) {
  const rows = await query(
    `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
    `,
    params
  );

  return rows[0]?.total || 0;
}

async function listUsersByWhereWithPagination(whereClause, params, sortColumn, sortDir, pageSize, offset) {
  return query(
    `
      SELECT
        u.id,
        u.user_name AS userName,
        CONCAT_WS(' ', u.first_name, u.last_name) AS fullName,
        u.email,
        ur.id AS roleId,
        ur.role,
        u.is_authorized AS isAuthorized,
        u.created_at AS createdAt
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  );
}

async function listDistinctUserNameOptions(whereClause, params) {
  return query(
    `
      SELECT DISTINCT u.user_name
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
      ORDER BY u.user_name ASC
    `,
    params
  );
}

async function listDistinctFullNameOptions(whereClause, params) {
  return query(
    `
      SELECT DISTINCT CONCAT_WS(' ', u.first_name, u.last_name) AS full_name
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
      ORDER BY full_name ASC
    `,
    params
  );
}

async function listDistinctEmailOptions(whereClause, params) {
  return query(
    `
      SELECT DISTINCT u.email
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
      ORDER BY u.email ASC
    `,
    params
  );
}

async function listDistinctRoleOptions(whereClause, params) {
  return query(
    `
      SELECT DISTINCT ur.role
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
      ORDER BY ur.role ASC
    `,
    params
  );
}

async function listDistinctAuthorizationOptions(whereClause, params) {
  return query(
    `
      SELECT DISTINCT u.is_authorized
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
      ORDER BY u.is_authorized DESC
    `,
    params
  );
}

async function listUsersForExport(whereClause, params, sortColumn, sortDir) {
  return query(
    `
      SELECT
        u.id,
        u.user_name AS userName,
        CONCAT_WS(' ', u.first_name, u.last_name) AS fullName,
        u.email,
        ur.id AS roleId,
        ur.role,
        u.is_authorized AS isAuthorized,
        u.created_at AS createdAt
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}
    `,
    params
  );
}

module.exports = {
  listUsers,
  listActiveUserRoles,
  findUserByIdForEdit,
  findRoleById,
  findUserNameConflict,
  findEmailConflict,
  updateUserById,
  countUsersByWhere,
  listUsersByWhereWithPagination,
  listDistinctUserNameOptions,
  listDistinctFullNameOptions,
  listDistinctEmailOptions,
  listDistinctRoleOptions,
  listDistinctAuthorizationOptions,
  listUsersForExport
};