const test = require('node:test');
const assert = require('node:assert/strict');

const authController = require('../src/controllers/auth.controller');
const { basePath } = require('../src/config/runtime');
const { createResponseMock } = require('./helpers/http-mocks');

const appsUrl = `${basePath}/apps`;
const loginUrl = `${basePath}/login`;

test('redirectRoot sends authenticated users to apps', () => {
  const req = { session: { user: { id: 'u1' } } };
  const res = createResponseMock();

  authController.redirectRoot(req, res);

  assert.equal(res.redirectUrl, appsUrl);
});

test('redirectRoot sends anonymous users to login', () => {
  const req = { session: {} };
  const res = createResponseMock();

  authController.redirectRoot(req, res);

  assert.equal(res.redirectUrl, loginUrl);
});

test('renderLogin redirects when already authenticated', () => {
  const req = { session: { user: { id: 'u1' } } };
  const res = createResponseMock();

  authController.renderLogin(req, res);

  assert.equal(res.redirectUrl, appsUrl);
});

test('renderLogin renders login view for anonymous users', () => {
  const req = { session: {} };
  const res = createResponseMock();

  authController.renderLogin(req, res);

  assert.equal(res.view, 'auth/login');
  assert.equal(res.viewData.pageTitle, 'Login');
  assert.equal(res.viewData.errorMessage, null);
});

test('render401 returns 401 and proper reason', () => {
  const req = {};
  const res = createResponseMock();

  authController.render401(req, res, 'not_authenticated');

  assert.equal(res.statusCode, 401);
  assert.equal(res.view, 'errors/401');
  assert.equal(res.viewData.reason, 'not_authenticated');
});
