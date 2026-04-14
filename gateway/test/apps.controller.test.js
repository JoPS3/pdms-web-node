const test = require('node:test');
const assert = require('node:assert/strict');

const { listApps } = require('../src/controllers/apps.controller');
const { createResponseMock } = require('./helpers/http-mocks');

test('apps controller renders apps index with user and role info', () => {
  const req = {
    session: {
      user: {
        userName: 'admin',
        email: 'admin@pedaco.local',
        role: 'admin'
      }
    }
  };
  const res = createResponseMock();

  listApps(req, res);

  assert.equal(res.view, 'apps/index');
  assert.equal(res.viewData.pageTitle, 'Aplicações');
  assert.equal(res.viewData.userName, 'admin');
  assert.equal(res.viewData.userEmail, 'admin@pedaco.local');
  assert.equal(res.viewData.userRole, 'admin');
  assert.equal(Array.isArray(res.viewData.apps), true);
  assert.equal(res.viewData.apps.length, 5);
});

test('apps controller uses fallback user values', () => {
  const req = {
    session: {
      user: {}
    }
  };
  const res = createResponseMock();

  listApps(req, res);

  assert.equal(res.viewData.userName, 'Utilizador');
  assert.equal(res.viewData.userEmail, '');
  assert.equal(res.viewData.userRole, '');
});

test('apps controller includes autenticacao desktop entry', () => {
  const req = {
    session: {
      user: {}
    }
  };
  const res = createResponseMock();

  listApps(req, res);

  const authApp = res.viewData.apps.find((app) => app.id === 'autenticacao');

  assert.equal(Boolean(authApp), true);
  assert.equal(authApp.name, 'Autenticação');
  assert.equal(authApp.icon, '🔐');
});
