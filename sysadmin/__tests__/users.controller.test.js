jest.mock('../src/services/users.service', () => ({
  listUsers: jest.fn(),
  listActiveUserRoles: jest.fn(),
  getUserByIdForEdit: jest.fn(),
  updateUserFromEditById: jest.fn()
}));

jest.mock('../src/services/users-filters.service', () => ({
  listUsersWithPagination: jest.fn(),
  getUsersTableFilterOptions: jest.fn(),
  listUsersForExport: jest.fn()
}));

jest.mock('../src/services/mapas-audit.service', () => ({
  createUserUpdateAuditLog: jest.fn()
}));

jest.mock('../src/middlewares/session.middleware', () => ({
  parseSessionToken: jest.fn(() => 'session-token-123')
}));

const usersController = require('../src/controllers/users.gui.controller');
const {
  getUserByIdForEdit,
  listActiveUserRoles
} = require('../src/services/users.service');
const {
  listUsersWithPagination,
  getUsersTableFilterOptions
} = require('../src/services/users-filters.service');
const { createUserUpdateAuditLog } = require('../src/services/mapas-audit.service');

function createResMock(basePath = '/pdms-new/sysadmin') {
  const res = {
    locals: { basePath },
    app: { get: jest.fn((key) => (key === 'mapasAuditLogUrl' ? 'http://localhost:6002/pdms-new/mapas/internal/auditoria/log' : undefined)) },
    status: jest.fn(),
    render: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    send: jest.fn()
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('users.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getHomePage renders app/index with user metadata, session data, and users list', async () => {
    const req = {
      query: {},
      user: { id: 'u-1', userName: 'alice', email: 'alice@example.com', role: 'ADMINISTRADOR', roleId: 1 }
    };
    const res = createResMock();
    listUsersWithPagination.mockResolvedValue({
      rows: [{ id: 'u-2', userName: 'bob' }],
      pagination: { currentPage: 1, pageSize: 50, totalRecords: 1, totalPages: 1, from: 1, to: 1 },
      sortBy: 'userName',
      sortDir: 'ASC'
    });
    getUsersTableFilterOptions.mockResolvedValue({ userName: ['bob'] });
    listActiveUserRoles.mockResolvedValue([{ id: 'r-1', role: 'ADMINISTRADOR' }]);

    await usersController.getHomePage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(listUsersWithPagination).toHaveBeenCalledWith(1, 50, {}, 'userName', 'ASC');
    expect(res.render).toHaveBeenCalledWith('app/index', expect.objectContaining({
      pageTitle: 'Utilizadores',
      userName: 'alice',
      userRole: 'ADMINISTRADOR',
      userId: 'u-1',
      usersList: expect.any(Array),
      session: expect.objectContaining({
        userId: 'u-1',
        userName: 'alice',
        email: 'alice@example.com',
        role: 'ADMINISTRADOR',
        roleId: 1
      })
    }));
  });

  test('getEditUserPage renders users/user-edit when user exists', async () => {
    const req = {
      params: { userId: 'u-100' },
      user: { id: 'u-admin', userName: 'admin', role: 'ADMINISTRADOR' }
    };
    const res = createResMock();

    getUserByIdForEdit.mockResolvedValue({
      id: 'u-100',
      userName: 'jorge',
      fullName: 'Jorge Silva',
      email: 'jorge@example.com',
      role: 'OPERADOR',
      isAuthorized: true
    });

    await usersController.getEditUserPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('users/user-edit', expect.objectContaining({
      userToEdit: expect.objectContaining({ id: 'u-100' })
    }));
  });

  test('getEditUserPage returns 404 when user does not exist', async () => {
    const req = {
      params: { userId: 'u-999' },
      user: { id: 'u-admin', userName: 'admin', role: 'ADMINISTRADOR' }
    };
    const res = createResMock();

    getUserByIdForEdit.mockResolvedValue(null);

    await usersController.getEditUserPage(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith('errors/404', expect.anything());
  });
});
