const { parseTableFiltersFromQuery } = require('../utils/table-filters');
const { createCsv, createFlatOdf } = require('../utils/users-export');
const {
  listActiveUserRoles,
  getUserByIdForEdit
} = require('../services/users.service');
const {
  listUsersWithPagination,
  getUsersTableFilterOptions,
  listUsersForExport
} = require('../services/users-filters.service');

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
    console.error('[sysadmin] Erro ao obter lista de utilizadores:', error.message);
    usersData = {
      rows: [],
      pagination: { currentPage: 1, pageSize: 50, totalRecords: 0, totalPages: 1, from: 0, to: 0 },
      sortBy,
      sortDir
    };
  }

  res.status(200).render('index', {
    pageTitle: 'Utilizadores',
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
      res.setHeader('Content-Disposition', `attachment; filename="usuarios-filtrados-${stamp}.fods"`);
      res.status(200).send(body);
      return;
    }

    const body = createCsv(result.rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="usuarios-filtrados-${stamp}.csv"`);
    res.status(200).send(body);
  } catch (error) {
    console.error('[sysadmin] Erro ao exportar utilizadores filtrados:', error.message);
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
    console.error('[sysadmin] Erro ao abrir view de edicao de utilizador:', error.message);
    return res.status(500).render('error', {
      title: 'Erro',
      error: 'Nao foi possivel abrir a view de edicao do utilizador.'
    });
  }
}

module.exports = {
  getHomePage,
  exportUsersList,
  getEditUserPage
};
