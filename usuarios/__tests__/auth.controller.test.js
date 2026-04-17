jest.mock('../src/services/password.service', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn()
}));

jest.mock('../src/services/user-password.service', () => ({
  getUserPasswordById: jest.fn(),
  updateUserPasswordById: jest.fn()
}));

jest.mock('../src/services/users-list.service', () => ({
  listUsers: jest.fn(),
  listActiveUserRoles: jest.fn(),
  listUsersWithPagination: jest.fn(),
  getUsersTableFilterOptions: jest.fn(),
  listUsersForExport: jest.fn(),
  getUserByIdForEdit: jest.fn(),
  updateUserFromEditById: jest.fn()
}));

jest.mock('../src/services/mapas-audit.service', () => ({
  createPasswordChangeAuditLog: jest.fn(),
  createUserUpdateAuditLog: jest.fn()
}));

jest.mock('../src/middlewares/auth.middleware', () => ({
  parseSessionToken: jest.fn(() => 'session-token-123')
}));

const authController = require('../src/controllers/auth.controller');
const { hashPassword, verifyPassword } = require('../src/services/password.service');
const { getUserPasswordById, updateUserPasswordById } = require('../src/services/user-password.service');
const { listUsersWithPagination, getUsersTableFilterOptions, getUserByIdForEdit, listActiveUserRoles } = require('../src/services/users-list.service');
const { createPasswordChangeAuditLog } = require('../src/services/mapas-audit.service');

function createResMock(basePath = '/pdms-new/usuarios') {
  const res = {
    locals: { basePath },
    app: { get: jest.fn((key) => (key === 'mapasAuditLogUrl' ? 'http://localhost:6002/pdms-new/mapas/internal/auditoria/log' : undefined)) },
    status: jest.fn(),
    render: jest.fn(),
    json: jest.fn()
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('usuarios.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getHomePage renders index with user metadata, session data, and users list', async () => {
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

    await authController.getHomePage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(listUsersWithPagination).toHaveBeenCalledWith(1, 50, {}, 'userName', 'ASC');
    expect(res.render).toHaveBeenCalledWith('index', expect.objectContaining({
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

  test('getEditUserPage renders user-edit when user exists', async () => {
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

    await authController.getEditUserPage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('user-edit', expect.objectContaining({
      userToEdit: expect.objectContaining({ id: 'u-100' })
    }));
  });

  test('getInternalSessionStatus returns active session payload', () => {
    const req = {
      user: { id: 'u-3', userName: 'carol', role: 'ADMINISTRADOR' }
    };
    const res = createResMock();

    authController.getInternalSessionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      session: expect.objectContaining({
        valid: true,
        userId: 'u-3',
        userName: 'carol',
        role: 'ADMINISTRADOR'
      })
    }));
  });

  test('changeInternalSessionPassword returns 400 when confirmation mismatches', async () => {
    const req = {
      user: { id: 'u-9', userName: 'sam' },
      body: {
        currentPassword: 'old',
        newPassword: 'new-password-1',
        confirmPassword: 'new-password-2'
      }
    };
    const res = createResMock();

    await authController.changeInternalSessionPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'password_confirmation_mismatch'
    }));
    expect(getUserPasswordById).not.toHaveBeenCalled();
  });

  test('changeInternalSessionPassword updates password when input is valid', async () => {
    const req = {
      user: { id: 'u-10', userName: 'maria' },
      body: {
        currentPassword: 'old-secret',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123'
      }
    };
    const res = createResMock();

    getUserPasswordById.mockResolvedValue({ id: 'u-10', password: 'scrypt$abc$def' });
    verifyPassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue('scrypt$new$saltedhash');
    updateUserPasswordById.mockResolvedValue(1);
    createPasswordChangeAuditLog.mockResolvedValue({ id: 'audit-1' });

    await authController.changeInternalSessionPassword(req, res);

    expect(getUserPasswordById).toHaveBeenCalledWith('u-10');
    expect(verifyPassword).toHaveBeenCalledWith('old-secret', 'scrypt$abc$def');
    expect(hashPassword).toHaveBeenCalledWith('new-password-123');
    expect(updateUserPasswordById).toHaveBeenCalledWith('u-10', 'scrypt$new$saltedhash', 'maria');
    expect(createPasswordChangeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      targetUserId: 'u-10',
      sessionToken: 'session-token-123'
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      auditStatus: 'ok'
    }));
  });

  test('changeInternalSessionPassword returns success with audit warning when audit fails', async () => {
    const req = {
      user: { id: 'u-11', userName: 'rui', role: 'ADMINISTRADOR' },
      body: {
        currentPassword: 'old-secret',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123'
      }
    };
    const res = createResMock();

    getUserPasswordById.mockResolvedValue({ id: 'u-11', password: '$2b$10$legacyhash' });
    verifyPassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue('$2b$10$newhash');
    updateUserPasswordById.mockResolvedValue(1);
    createPasswordChangeAuditLog.mockRejectedValue(new Error('mapas offline'));

    await authController.changeInternalSessionPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      auditStatus: 'failed'
    }));
  });
});
