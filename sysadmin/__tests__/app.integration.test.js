const request = require('supertest');

const mockAuthMode = {
  web: 'allow',
  api: 'allow'
};

const mockGetHomePage = jest.fn((req, res) => res.status(200).send('home-page'));
const mockGetUsersListPage = jest.fn((req, res) => res.status(200).send('users-list-page'));
const mockGetEditUserPage = jest.fn((req, res) => res.status(200).send('edit-user-page'));
const mockGetSessionStatus = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'get-session-status' }));
const mockGetInternalSessionStatus = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'session-status' }));
const mockGetInternalOneDriveSetup = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'onedrive-setup' }));
const mockSaveInternalOneDriveSetup = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'onedrive-setup-save' }));
const mockChangeInternalSessionPassword = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'change-password' }));
const mockGetInternalOneDriveStatus = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'onedrive-status' }));
const mockStartInternalOneDriveConnect = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'onedrive-connect' }));
const mockDisconnectInternalOneDrive = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'onedrive-disconnect' }));
const mockExportUsersList = jest.fn((req, res) => res.status(200).send('export-users-list'));
const mockUpdateUserFromEdit = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'update-user' }));

jest.mock('../src/controllers/sysadmin.api.controller', () => ({
  getSessionStatus: (req, res, next) => mockGetSessionStatus(req, res, next),
  getInternalSessionStatus: (req, res, next) => mockGetInternalSessionStatus(req, res, next),
  changeInternalSessionPassword: (req, res, next) => mockChangeInternalSessionPassword(req, res, next)
}));

jest.mock('../src/controllers/onedrive.api.controller', () => ({
  getInternalOneDriveSetup: (req, res, next) => mockGetInternalOneDriveSetup(req, res, next),
  saveInternalOneDriveSetup: (req, res, next) => mockSaveInternalOneDriveSetup(req, res, next),
  getInternalOneDriveStatus: (req, res, next) => mockGetInternalOneDriveStatus(req, res, next),
  startInternalOneDriveConnect: (req, res, next) => mockStartInternalOneDriveConnect(req, res, next),
  disconnectInternalOneDrive: (req, res, next) => mockDisconnectInternalOneDrive(req, res, next)
}));

jest.mock('../src/controllers/users.gui.controller', () => ({
  getHomePage: (req, res, next) => mockGetHomePage(req, res, next),
  getUsersListPage: (req, res, next) => mockGetUsersListPage(req, res, next),
  getEditUserPage: (req, res, next) => mockGetEditUserPage(req, res, next),
  exportUsersList: (req, res, next) => mockExportUsersList(req, res, next)
}));

jest.mock('../src/controllers/users.api.controller', () => ({
  updateUserFromEdit: (req, res, next) => mockUpdateUserFromEdit(req, res, next)
}));

jest.mock('../src/middlewares/session.middleware', () => ({
  requireGatewayAuth: (req, res, next) => {
    if (mockAuthMode.web === 'deny') {
      return res.redirect('/pdms-new/login');
    }
    req.user = {
      id: 'user-1',
      userName: 'tester',
      role: 'ADMINISTRADOR'
    };
    return next();
  },
  requireGatewaySessionApi: (req, res, next) => {
    if (mockAuthMode.api === 'deny') {
      return res.status(401).json({
        error: 'invalid_gateway_session',
        message: 'Sessao invalida ou expirada no gateway.'
      });
    }
    req.user = {
      id: 'user-1',
      userName: 'tester',
      role: 'ADMINISTRADOR'
    };
    return next();
  }
}));

describe('sysadmin app integration routes', () => {
  let app;
  const basePath = '/pdms-new/sysadmin';

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
    process.env.BASE_PATH_DEV = basePath;
    process.env.BASE_PATH_PROD = '/pdms/sysadmin';
    process.env.GATEWAY_BASE_PATH_DEV = '/pdms-new';
    process.env.GATEWAY_BASE_PATH_PROD = '/pdms';
    process.env.GATEWAY_VALIDATE_DEV = 'http://localhost:6000/pdms-new/validate-session';
    process.env.GATEWAY_VALIDATE_PROD = 'http://localhost:6000/pdms/validate-session';

    app = require('../src/app');
  });

  beforeEach(() => {
    mockAuthMode.web = 'allow';
    mockAuthMode.api = 'allow';
    jest.clearAllMocks();
  });

  test('GET health is public and returns status payload', async () => {
    const response = await request(app).get(`${basePath}/health`);

    expect(response.status).toBe(200);
    expect(response.body.service).toBe('sysadmin');
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeTruthy();
  });

  test('GET app home redirects to login when web auth fails', async () => {
    mockAuthMode.web = 'deny';

    const response = await request(app).get(`${basePath}/`);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/pdms-new/login');
  });

  test('GET app home delegates to auth controller', async () => {
    const response = await request(app).get(`${basePath}/`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('home-page');
    expect(mockGetHomePage).toHaveBeenCalledTimes(1);
  });

  test('GET users list delegates to users list controller', async () => {
    const response = await request(app).get(`${basePath}/users/list`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('users-list-page');
    expect(mockGetUsersListPage).toHaveBeenCalledTimes(1);
  });

  test('GET edit user page delegates to auth controller', async () => {
    const response = await request(app).get(`${basePath}/users/123/edit`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('edit-user-page');
    expect(mockGetEditUserPage).toHaveBeenCalledTimes(1);
  });

  test('POST internal route returns 401 when api auth fails', async () => {
    mockAuthMode.api = 'deny';

    const response = await request(app)
      .post(`${basePath}/internal/session/status`)
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('invalid_gateway_session');
    expect(mockGetInternalSessionStatus).not.toHaveBeenCalled();
  });

  test('POST internal route reaches controller when api auth passes', async () => {
    const response = await request(app)
      .post(`${basePath}/internal/session/status`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('session-status');
    expect(mockGetInternalSessionStatus).toHaveBeenCalledTimes(1);
  });

  test('POST internal change-password returns 401 when api auth fails', async () => {
    mockAuthMode.api = 'deny';

    const response = await request(app)
      .post(`${basePath}/internal/session/change-password`)
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('invalid_gateway_session');
    expect(mockChangeInternalSessionPassword).not.toHaveBeenCalled();
  });

  test('POST internal change-password reaches controller when api auth passes', async () => {
    const response = await request(app)
      .post(`${basePath}/internal/session/change-password`)
      .send({
        currentPassword: 'old-secret',
        newPassword: 'new-secret-123',
        confirmPassword: 'new-secret-123'
      });

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('change-password');
    expect(mockChangeInternalSessionPassword).toHaveBeenCalledTimes(1);
  });
});
