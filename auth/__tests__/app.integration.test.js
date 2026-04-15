const request = require('supertest');

const mockAuthMode = {
  web: 'allow',
  api: 'allow'
};

const mockGetHomePage = jest.fn((req, res) => res.status(200).send('home-page'));
const mockGetEditUserPage = jest.fn((req, res) => res.status(200).send('edit-user-page'));
const mockGetSessionStatus = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'get-session-status' }));
const mockGetInternalSessionStatus = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'session-status' }));
const mockChangeInternalSessionPassword = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'change-password' }));
const mockExportUsersList = jest.fn((req, res) => res.status(200).send('export-users-list'));
const mockUpdateUserFromEdit = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'update-user' }));

jest.mock('../src/controllers/auth.controller', () => ({
  getHomePage: (req, res, next) => mockGetHomePage(req, res, next),
  getEditUserPage: (req, res, next) => mockGetEditUserPage(req, res, next),
  getSessionStatus: (req, res, next) => mockGetSessionStatus(req, res, next),
  getInternalSessionStatus: (req, res, next) => mockGetInternalSessionStatus(req, res, next),
  changeInternalSessionPassword: (req, res, next) => mockChangeInternalSessionPassword(req, res, next),
  exportUsersList: (req, res, next) => mockExportUsersList(req, res, next),
  updateUserFromEdit: (req, res, next) => mockUpdateUserFromEdit(req, res, next)
}));

jest.mock('../src/middlewares/auth.middleware', () => ({
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

describe('auth app integration routes', () => {
  let app;
  const basePath = '/pdms-new/auth';

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
    process.env.BASE_PATH_DEV = basePath;
    process.env.BASE_PATH_PROD = '/pdms/auth';
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
    expect(response.body.service).toBe('auth');
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
