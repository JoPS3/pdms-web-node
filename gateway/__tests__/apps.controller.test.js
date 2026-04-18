const { listApps } = require('../src/controllers/apps.controller');
const { createResponseMock } = require('./helpers/http-mocks');

function createRequest(authUser = {}) {
  return {
    authUser,
    hostname: 'localhost',
    protocol: 'http',
    get: () => ''
  };
}

test('apps controller renders apps index with user and role info', () => {
  const req = createRequest({
    userName: 'admin',
    email: 'admin@pedaco.local',
    role: 'ADMINISTRADOR'
  });
  const res = createResponseMock();

  listApps(req, res);

  expect(res.view).toBe('apps/index');
  expect(res.viewData.pageTitle).toBe('Aplicações');
  expect(res.viewData.userName).toBe('admin');
  expect(res.viewData.userEmail).toBe('admin@pedaco.local');
  expect(res.viewData.userRole).toBe('ADMINISTRADOR');
  expect(Array.isArray(res.viewData.apps)).toBe(true);
  expect(res.viewData.apps.length).toBe(5);
});

test('apps controller uses fallback user values', () => {
  const req = createRequest({});
  const res = createResponseMock();

  listApps(req, res);

  expect(res.viewData.userName).toBe('Utilizador');
  expect(res.viewData.userEmail).toBe('');
  expect(res.viewData.userRole).toBe('');
  expect(res.viewData.apps).toEqual([]);
});

test('apps controller includes sysadmin desktop entry', () => {
  const req = createRequest({ role: 'ADMINISTRADOR' });
  const res = createResponseMock();

  listApps(req, res);

  const authApp = res.viewData.apps.find((app) => app.id === 'sysadmin');

  expect(authApp).toBeTruthy();
  expect(authApp.name).toBe('Utilizadores');
  expect(authApp.icon).toBe('🔐');
});

test('apps controller returns no apps for non-admin role', () => {
  const req = createRequest({ role: 'COLABORADOR' });
  const res = createResponseMock();

  listApps(req, res);

  expect(res.viewData.apps).toEqual([]);
});
