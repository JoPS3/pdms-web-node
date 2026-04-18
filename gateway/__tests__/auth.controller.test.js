const authController = require('../src/controllers/auth.gui.controller');
const AuthService = require('../src/services/auth.service');
const { basePath } = require('../src/config/runtime');
const { createResponseMock } = require('./helpers/http-mocks');

jest.mock('../src/services/auth.service');

const appsUrl = `${basePath}/apps`;
const loginUrl = `${basePath}/login`;

test('redirectRoot sends authenticated users to apps', async () => {
  AuthService.validateSession.mockResolvedValue({ valid: true });
  const req = {
    headers: { authorization: 'Bearer token-123' },
    cookies: {},
    ip: '127.0.0.1',
    get: jest.fn(() => 'agent')
  };
  const res = createResponseMock();

  await authController.redirectRoot(req, res);

  expect(res.redirectUrl).toBe(appsUrl);
});

test('redirectRoot sends anonymous users to login', async () => {
  const req = { headers: {}, cookies: {} };
  const res = createResponseMock();

  await authController.redirectRoot(req, res);

  expect(res.redirectUrl).toBe(loginUrl);
});

test('renderLogin redirects when already authenticated', async () => {
  const req = { headers: { authorization: 'Bearer token-123' }, cookies: {} };
  const res = createResponseMock();

  await authController.renderLogin(req, res);

  expect(res.redirectUrl).toBe(appsUrl);
});

test('renderLogin renders login view for anonymous users', async () => {
  const req = { headers: {}, cookies: {} };
  const res = createResponseMock();

  await authController.renderLogin(req, res);

  expect(res.view).toBe('auth/login');
  expect(res.viewData.pageTitle).toBe('Login');
  expect(res.viewData.errorMessage).toBeNull();
});

test('render401 returns 401 and proper reason', () => {
  const req = {};
  const res = createResponseMock();

  authController.render401(req, res, 'not_authenticated');

  expect(res.statusCode).toBe(401);
  expect(res.view).toBe('errors/401');
  expect(res.viewData.reason).toBe('not_authenticated');
});
