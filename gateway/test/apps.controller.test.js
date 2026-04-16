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

  expect(res.view).toBe('apps/index');
  expect(res.viewData.pageTitle).toBe('Aplicações');
  expect(res.viewData.userName).toBe('admin');
  expect(res.viewData.userEmail).toBe('admin@pedaco.local');
  expect(res.viewData.userRole).toBe('admin');
  expect(Array.isArray(res.viewData.apps)).toBe(true);
  expect(res.viewData.apps.length).toBe(5);
});

test('apps controller uses fallback user values', () => {
  const req = {
    session: {
      user: {}
    }
  };
  const res = createResponseMock();

  listApps(req, res);

  expect(res.viewData.userName).toBe('Utilizador');
  expect(res.viewData.userEmail).toBe('');
  expect(res.viewData.userRole).toBe('');
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

  expect(authApp).toBeTruthy();
  expect(authApp.name).toBe('Autenticação');
  expect(authApp.icon).toBe('🔐');
});
