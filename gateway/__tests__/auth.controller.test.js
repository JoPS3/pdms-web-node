const authController = require('../src/controllers/auth.controller');
const { basePath } = require('../src/config/runtime');
const { createResponseMock } = require('./helpers/http-mocks');

const appsUrl = `${basePath}/apps`;
const loginUrl = `${basePath}/login`;

test('redirectRoot sends authenticated users to apps', () => {
  const req = { session: { user: { id: 'u1' } } };
  const res = createResponseMock();

  authController.redirectRoot(req, res);

  expect(res.redirectUrl).toBe(appsUrl);
});

test('redirectRoot sends anonymous users to login', () => {
  const req = { session: {} };
  const res = createResponseMock();

  authController.redirectRoot(req, res);

  expect(res.redirectUrl).toBe(loginUrl);
});

test('renderLogin redirects when already authenticated', () => {
  const req = { session: { user: { id: 'u1' } } };
  const res = createResponseMock();

  authController.renderLogin(req, res);

  expect(res.redirectUrl).toBe(appsUrl);
});

test('renderLogin renders login view for anonymous users', () => {
  const req = { session: {} };
  const res = createResponseMock();

  authController.renderLogin(req, res);

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
