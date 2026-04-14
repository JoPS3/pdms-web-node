jest.mock('../src/services/password.service', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn()
}));

jest.mock('../src/services/user-password.service', () => ({
  getUserPasswordById: jest.fn(),
  updateUserPasswordById: jest.fn()
}));

jest.mock('../src/services/users-list.service', () => ({
  listUsers: jest.fn()
}));

jest.mock('../src/services/mapas-audit.service', () => ({
  createPasswordChangeAuditLog: jest.fn()
}));

jest.mock('../src/middlewares/auth.middleware', () => ({
  parseSessionToken: jest.fn(() => 'session-token-123')
}));

const authController = require('../src/controllers/auth.controller');
const { hashPassword, verifyPassword } = require('../src/services/password.service');
const { getUserPasswordById, updateUserPasswordById } = require('../src/services/user-password.service');
const { listUsers } = require('../src/services/users-list.service');
const { createPasswordChangeAuditLog } = require('../src/services/mapas-audit.service');

function createResMock(basePath = '/pdms-new/auth') {
  const res = {
    locals: { basePath },
    app: { get: jest.fn((key) => (key === 'mapasAuditLogUrl' ? 'http://localhost:6001/pdms-new/mapas/internal/auditoria/log' : undefined)) },
    status: jest.fn(),
    render: jest.fn(),
    json: jest.fn()
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('auth.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getHomePage renders index with user metadata, session data, and users list', async () => {
    const req = {
      user: { id: 'u-1', userName: 'alice', email: 'alice@example.com', role: 'ADMINISTRADOR', roleId: 1 }
    };
    const res = createResMock();
    listUsers.mockResolvedValue([{ id: 'u-2', userName: 'bob' }]);

    await authController.getHomePage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(listUsers).toHaveBeenCalledWith(100);
    expect(res.render).toHaveBeenCalledWith('index', expect.objectContaining({
      pageTitle: 'Auth',
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
