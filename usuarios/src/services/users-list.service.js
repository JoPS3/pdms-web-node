const { query } = require('../db/mysql');

async function listUsers(limit = 100) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 500)) : 100;

  const rows = await query(
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
      LIMIT ${safeLimit}
    `
  );

  return rows.map((row) => ({
    id: row.id,
    userName: row.userName || '',
    fullName: row.fullName || '',
    email: row.email || '',
    roleId: row.roleId || null,
    role: row.role || '',
    isAuthorized: Boolean(row.isAuthorized),
    createdAt: row.createdAt || null
  }));
}

async function listActiveUserRoles() {
  const rows = await query(
    `
      SELECT id, role
      FROM users_role
      WHERE is_deleted = 0
      ORDER BY role ASC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    role: row.role || ''
  }));
}

async function getUserByIdForEdit(userId) {
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

  const row = rows[0];
  if (!row) return null;

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

  const roleRows = await query(
    `
      SELECT id
      FROM users_role
      WHERE id = ?
        AND is_deleted = 0
      LIMIT 1
    `,
    [safeRoleId]
  );
  if (!roleRows[0]) {
    return { ok: false, error: 'invalid_role' };
  }

  const userNameConflictRows = await query(
    `
      SELECT id
      FROM users
      WHERE user_name = ?
        AND id <> ?
        AND is_deleted = 0
      LIMIT 1
    `,
    [safeUserName, safeUserId]
  );
  if (userNameConflictRows[0]) {
    return { ok: false, error: 'duplicate_user_name' };
  }

  const emailConflictRows = await query(
    `
      SELECT id
      FROM users
      WHERE email = ?
        AND id <> ?
        AND is_deleted = 0
      LIMIT 1
    `,
    [safeEmail, safeUserId]
  );
  if (emailConflictRows[0]) {
    return { ok: false, error: 'duplicate_email' };
  }

  const nameParts = safeFullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || safeFullName;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  const result = await query(
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
      safeRoleId,
      firstName,
      lastName || null,
      safeUserName,
      safeEmail,
      safeIsAuthorized,
      safeClearPassword,
      changedBy,
      safeUserId
    ]
  );

  return {
    ok: Boolean(result.affectedRows),
    error: result.affectedRows ? null : 'not_found'
  };
}

function buildUsersFilteredQueryContext(tableFilters = {}, sortBy = 'userName', sortDir = 'ASC') {
  const safeSortDir = (sortDir === 'DESC') ? 'DESC' : 'ASC';

  // Allowed filter keys and sort columns
  const allowedFilterKeys = ['userName', 'fullName', 'email', 'role', 'isAuthorized'];
  const sortableFields = {
    userName: 'u.user_name',
    fullName: 'CONCAT_WS(" ", u.first_name, u.last_name)',
    email: 'u.email',
    role: 'ur.role',
    isAuthorized: 'u.is_authorized',
    createdAt: 'u.created_at'
  };

  const safeSortBy = sortableFields[sortBy] ? sortBy : 'userName';
  const sortColumn = sortableFields[safeSortBy];

  // Build WHERE conditions
  const whereConditions = ['u.is_deleted = 0'];
  const filterParams = [];

  for (const [key, values] of Object.entries(tableFilters || {})) {
    if (!allowedFilterKeys.includes(key) || !Array.isArray(values) || values.length === 0) {
      continue;
    }

    // Filter out __EMPTY__ sentinel and handle empty selections
    const nonEmptyValues = values.filter((v) => v !== '__EMPTY__');
    const hasEmpty = values.includes('__EMPTY__');

    if (nonEmptyValues.length === 0 && hasEmpty) {
      // Explicit empty selection
      if (key === 'isAuthorized') {
        whereConditions.push('u.is_authorized IS NULL');
      } else if (key === 'role') {
        whereConditions.push('ur.role IS NULL');
      } else if (key === 'fullName') {
        whereConditions.push("CONCAT_WS(' ', u.first_name, u.last_name) = ''");
      } else if (key === 'email') {
        whereConditions.push('(u.email IS NULL OR u.email = \'\')');
      } else if (key === 'userName') {
        whereConditions.push('(u.user_name IS NULL OR u.user_name = \'\')');
      } else {
        whereConditions.push(`u.${key} IS NULL`);
      }
    } else if (nonEmptyValues.length > 0) {
      // Regular filter values
      if (key === 'isAuthorized') {
        const boolValues = nonEmptyValues.map((v) => (v === 'true' || v === '1') ? 1 : 0);
        whereConditions.push(`u.is_authorized IN (${boolValues.join(',')})`);
      } else {
        const placeholders = nonEmptyValues.map(() => '?').join(',');
        const columnExpr = key === 'role'
          ? 'ur.role'
          : key === 'userName'
            ? 'u.user_name'
            : key === 'fullName'
              ? "CONCAT_WS(' ', u.first_name, u.last_name)"
              : key === 'email'
                ? 'u.email'
                : `u.${key}`;
        whereConditions.push(`${columnExpr} IN (${placeholders})`);
        filterParams.push(...nonEmptyValues);
      }
    }
  }

  return {
    whereClause: whereConditions.join(' AND '),
    filterParams,
    safeSortBy,
    safeSortDir,
    sortColumn
  };
}

/**
 * List users with pagination and table filters
 */
async function listUsersWithPagination(
  page = 1,
  pageSize = 50,
  tableFilters = {},
  sortBy = 'userName',
  sortDir = 'ASC'
) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(10, Math.min(Number(pageSize) || 50, 200));
  const { whereClause, filterParams, safeSortBy, safeSortDir, sortColumn } = buildUsersFilteredQueryContext(tableFilters, sortBy, sortDir);

  // Count total records with filters
  const countSql = `
    SELECT COUNT(*) as total
    FROM users u
    LEFT JOIN users_role ur ON ur.id = u.role_id
    WHERE ${whereClause}
  `;
  const countResult = await query(countSql, filterParams);
  const totalRecords = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalRecords / safePageSize) || 1;

  // Fetch paginated data
  const offset = (safePage - 1) * safePageSize;
  const dataSql = `
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
    ORDER BY ${sortColumn} ${safeSortDir}
    LIMIT ? OFFSET ?
  `;
  const rows = await query(dataSql, [...filterParams, safePageSize, offset]);

  const from = totalRecords === 0 ? 0 : offset + 1;
  const to = Math.min(offset + safePageSize, totalRecords);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      userName: row.userName || '',
      fullName: row.fullName || '',
      email: row.email || '',
      roleId: row.roleId || null,
      role: row.role || '',
      isAuthorized: Boolean(row.isAuthorized),
      createdAt: row.createdAt || null
    })),
    pagination: {
      currentPage: safePage,
      pageSize: safePageSize,
      totalRecords,
      totalPages,
      from,
      to
    },
    sortBy: safeSortBy,
    sortDir: safeSortDir
  };
}

/**
 * Get filter options for users table (distinct values per column)
 * Respects other active filters (Excel-like behavior)
 */
async function getUsersTableFilterOptions(tableFilters = {}) {
  const allowedFilterKeys = ['userName', 'fullName', 'email', 'role', 'isAuthorized'];
  const options = {};

  // Build WHERE for other filters (ignore the current column being queried)
  const buildOtherFiltersWhere = (excludeKey) => {
    const conditions = ['u.is_deleted = 0'];
    const params = [];

    for (const [key, values] of Object.entries(tableFilters)) {
      if (key === excludeKey || !allowedFilterKeys.includes(key) || !Array.isArray(values) || values.length === 0) {
        continue;
      }

      const nonEmptyValues = values.filter((v) => v !== '__EMPTY__');
      const hasEmpty = values.includes('__EMPTY__');

      if (nonEmptyValues.length === 0 && hasEmpty) {
        if (key === 'isAuthorized') {
          conditions.push('u.is_authorized IS NULL');
        } else if (key === 'role') {
          conditions.push('ur.role IS NULL');
        } else if (key === 'fullName') {
          conditions.push("CONCAT_WS(' ', u.first_name, u.last_name) = ''");
        } else if (key === 'email') {
          conditions.push('(u.email IS NULL OR u.email = \'\')');
        } else if (key === 'userName') {
          conditions.push('(u.user_name IS NULL OR u.user_name = \'\')');
        } else {
          conditions.push(`u.${key} IS NULL`);
        }
      } else if (nonEmptyValues.length > 0) {
        if (key === 'isAuthorized') {
          const boolValues = nonEmptyValues.map((v) => (v === 'true' || v === '1') ? 1 : 0);
          conditions.push(`u.is_authorized IN (${boolValues.join(',')})`);
        } else {
          const placeholders = nonEmptyValues.map(() => '?').join(',');
          const columnExpr = key === 'role'
            ? 'ur.role'
            : key === 'userName'
              ? 'u.user_name'
              : key === 'fullName'
                ? "CONCAT_WS(' ', u.first_name, u.last_name)"
                : key === 'email'
                  ? 'u.email'
                  : `u.${key}`;
          conditions.push(`${columnExpr} IN (${placeholders})`);
          params.push(...nonEmptyValues);
        }
      }
    }

    return { where: conditions.join(' AND '), params };
  };

  // userName options
  let otherFilters = buildOtherFiltersWhere('userName');
  const userNameRows = await query(
    `
      SELECT DISTINCT u.user_name
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${otherFilters.where}
      ORDER BY u.user_name ASC
    `,
    otherFilters.params
  );
  options.userName = userNameRows.map((row) => row.user_name).filter(Boolean);

  // fullName options
  otherFilters = buildOtherFiltersWhere('fullName');
  const fullNameRows = await query(
    `
      SELECT DISTINCT CONCAT_WS(' ', u.first_name, u.last_name) AS full_name
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${otherFilters.where}
      ORDER BY full_name ASC
    `,
    otherFilters.params
  );
  options.fullName = fullNameRows.map((row) => row.full_name).filter(Boolean);

  // email options
  otherFilters = buildOtherFiltersWhere('email');
  const emailRows = await query(
    `
      SELECT DISTINCT u.email
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${otherFilters.where}
      ORDER BY u.email ASC
    `,
    otherFilters.params
  );
  options.email = emailRows.map((row) => row.email).filter(Boolean);

  // role options
  otherFilters = buildOtherFiltersWhere('role');
  const roleRows = await query(
    `
      SELECT DISTINCT ur.role
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${otherFilters.where}
      ORDER BY ur.role ASC
    `,
    otherFilters.params
  );
  options.role = roleRows.map((row) => row.role).filter(Boolean);

  // isAuthorized options
  otherFilters = buildOtherFiltersWhere('isAuthorized');
  const authRows = await query(
    `
      SELECT DISTINCT u.is_authorized
      FROM users u
      LEFT JOIN users_role ur ON ur.id = u.role_id
      WHERE ${otherFilters.where}
      ORDER BY u.is_authorized DESC
    `,
    otherFilters.params
  );
  options.isAuthorized = authRows
    .map((row) => (Boolean(row.is_authorized) ? 'true' : 'false'))
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  return options;
}

async function listUsersForExport(tableFilters = {}, sortBy = 'userName', sortDir = 'ASC') {
  const { whereClause, filterParams, safeSortBy, safeSortDir, sortColumn } = buildUsersFilteredQueryContext(tableFilters, sortBy, sortDir);

  const rows = await query(
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
      ORDER BY ${sortColumn} ${safeSortDir}
    `,
    filterParams
  );

  return {
    rows: rows.map((row) => ({
      id: row.id,
      userName: row.userName || '',
      fullName: row.fullName || '',
      email: row.email || '',
      roleId: row.roleId || null,
      role: row.role || '',
      isAuthorized: Boolean(row.isAuthorized),
      createdAt: row.createdAt || null
    })),
    sortBy: safeSortBy,
    sortDir: safeSortDir
  };
}

module.exports = {
  listUsers,
  listActiveUserRoles,
  listUsersWithPagination,
  getUsersTableFilterOptions,
  listUsersForExport,
  getUserByIdForEdit,
  updateUserFromEditById
};
