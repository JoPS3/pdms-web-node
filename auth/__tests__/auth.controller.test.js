const authController = require('../src/controllers/auth.controller');

function createResMock(basePath = '/pdms-new/auth') {
  const res = {
    locals: { basePath },
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

  test('getHomePage renders index with user metadata and session data', () => {
    const req = {
      user: { id: 'u-1', userName: 'alice', email: 'alice@example.com', role: 'ADMINISTRADOR', roleId: 1 }
    };
    const res = createResMock();

    authController.getHomePage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.render).toHaveBeenCalledWith('index', expect.objectContaining({
      pageTitle: 'Auth',
      userName: 'alice',
      userRole: 'ADMINISTRADOR',
      userId: 'u-1',
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
});
