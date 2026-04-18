const usersDAO = require('../daos/users.dao');
const { mapUserRow } = require('./users.service');

const ALLOWED_FILTER_KEYS = ['userName', 'fullName', 'email', 'role', 'isAuthorized'];

const SORTABLE_FIELDS = {
  userName: 'u.user_name',
  fullName: 'CONCAT_WS(" ", u.first_name, u.last_name)',
  email: 'u.email',
  role: 'ur.role',
  isAuthorized: 'u.is_authorized',
  createdAt: 'u.created_at'
};

function getColumnExpr(key) {
  const map = {
    role: 'ur.role',
    userName: 'u.user_name',
    fullName: "CONCAT_WS(' ', u.first_name, u.last_name)",
    email: 'u.email'
  };
  return map[key] || `u.${key}`;
}

function applyFilterCondition(key, values, whereConditions, filterParams) {
  const nonEmptyValues = values.filter((v) => v !== '__EMPTY__');
  const hasEmpty = values.includes('__EMPTY__');

  if (nonEmptyValues.length === 0 && hasEmpty) {
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
    if (key === 'isAuthorized') {
      const boolValues = nonEmptyValues.map((v) => (v === 'true' || v === '1') ? 1 : 0);
      whereConditions.push(`u.is_authorized IN (${boolValues.join(',')})`);
    } else {
      const placeholders = nonEmptyValues.map(() => '?').join(',');
      whereConditions.push(`${getColumnExpr(key)} IN (${placeholders})`);
      filterParams.push(...nonEmptyValues);
    }
  }
}

function buildUsersFilteredQueryContext(tableFilters = {}, sortBy = 'userName', sortDir = 'ASC') {
  const safeSortDir = (sortDir === 'DESC') ? 'DESC' : 'ASC';
  const safeSortBy = SORTABLE_FIELDS[sortBy] ? sortBy : 'userName';
  const sortColumn = SORTABLE_FIELDS[safeSortBy];

  const whereConditions = ['u.is_deleted = 0'];
  const filterParams = [];

  for (const [key, values] of Object.entries(tableFilters || {})) {
    if (!ALLOWED_FILTER_KEYS.includes(key) || !Array.isArray(values) || values.length === 0) continue;
    applyFilterCondition(key, values, whereConditions, filterParams);
  }

  return {
    whereClause: whereConditions.join(' AND '),
    filterParams,
    safeSortBy,
    safeSortDir,
    sortColumn
  };
}

function buildOtherFiltersWhere(tableFilters, excludeKey) {
  const conditions = ['u.is_deleted = 0'];
  const params = [];

  for (const [key, values] of Object.entries(tableFilters)) {
    if (key === excludeKey || !ALLOWED_FILTER_KEYS.includes(key) || !Array.isArray(values) || values.length === 0) continue;
    applyFilterCondition(key, values, conditions, params);
  }

  return { where: conditions.join(' AND '), params };
}

async function listUsersWithPagination(page = 1, pageSize = 50, tableFilters = {}, sortBy = 'userName', sortDir = 'ASC') {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(10, Math.min(Number(pageSize) || 50, 200));
  const { whereClause, filterParams, safeSortBy, safeSortDir, sortColumn } = buildUsersFilteredQueryContext(tableFilters, sortBy, sortDir);

  const totalRecords = await usersDAO.countUsersByWhere(whereClause, filterParams);
  const totalPages = Math.ceil(totalRecords / safePageSize) || 1;
  const offset = (safePage - 1) * safePageSize;

  const rows = await usersDAO.listUsersByWhereWithPagination(
    whereClause, filterParams, sortColumn, safeSortDir, safePageSize, offset
  );

  const from = totalRecords === 0 ? 0 : offset + 1;
  const to = Math.min(offset + safePageSize, totalRecords);

  return {
    rows: rows.map(mapUserRow),
    pagination: { currentPage: safePage, pageSize: safePageSize, totalRecords, totalPages, from, to },
    sortBy: safeSortBy,
    sortDir: safeSortDir
  };
}

async function getUsersTableFilterOptions(tableFilters = {}) {
  const options = {};

  const userNameRows = await usersDAO.listDistinctUserNameOptions(...Object.values(buildOtherFiltersWhere(tableFilters, 'userName')));
  options.userName = userNameRows.map((row) => row.user_name).filter(Boolean);

  const fullNameRows = await usersDAO.listDistinctFullNameOptions(...Object.values(buildOtherFiltersWhere(tableFilters, 'fullName')));
  options.fullName = fullNameRows.map((row) => row.full_name).filter(Boolean);

  const emailRows = await usersDAO.listDistinctEmailOptions(...Object.values(buildOtherFiltersWhere(tableFilters, 'email')));
  options.email = emailRows.map((row) => row.email).filter(Boolean);

  const roleRows = await usersDAO.listDistinctRoleOptions(...Object.values(buildOtherFiltersWhere(tableFilters, 'role')));
  options.role = roleRows.map((row) => row.role).filter(Boolean);

  const authRows = await usersDAO.listDistinctAuthorizationOptions(...Object.values(buildOtherFiltersWhere(tableFilters, 'isAuthorized')));
  options.isAuthorized = authRows
    .map((row) => (Boolean(row.is_authorized) ? 'true' : 'false'))
    .filter((v, i, a) => a.indexOf(v) === i);

  return options;
}

async function listUsersForExport(tableFilters = {}, sortBy = 'userName', sortDir = 'ASC') {
  const { whereClause, filterParams, safeSortBy, safeSortDir, sortColumn } = buildUsersFilteredQueryContext(tableFilters, sortBy, sortDir);
  const rows = await usersDAO.listUsersForExport(whereClause, filterParams, sortColumn, safeSortDir);

  return {
    rows: rows.map(mapUserRow),
    sortBy: safeSortBy,
    sortDir: safeSortDir
  };
}

module.exports = {
  listUsersWithPagination,
  getUsersTableFilterOptions,
  listUsersForExport
};
