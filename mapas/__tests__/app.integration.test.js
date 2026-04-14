const request = require('supertest');

const mockAuthMode = {
  web: 'allow',
  api: 'allow'
};

const mockGetDiarioCaixaPage = jest.fn((req, res) => res.status(200).send('diario-page'));
const mockGetAuditoriaLogsPage = jest.fn((req, res) => res.status(200).send('auditoria-page'));
const mockUpsertInternalDiarioCaixa = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'upsert' }));
const mockCheckInternalDiarioCaixa = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'existence' }));
const mockCreateInternalAuditoriaLog = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'auditoria-log' }));
const mockQueryInternalAuditoriaLogs = jest.fn((req, res) => res.status(200).json({ status: 'ok', route: 'auditoria-query' }));

jest.mock('../src/controllers/mapas.controller', () => ({
  getDiarioCaixaPage: (req, res, next) => mockGetDiarioCaixaPage(req, res, next),
  getAuditoriaLogsPage: (req, res, next) => mockGetAuditoriaLogsPage(req, res, next),
  upsertInternalDiarioCaixa: (req, res, next) => mockUpsertInternalDiarioCaixa(req, res, next),
  checkInternalDiarioCaixa: (req, res, next) => mockCheckInternalDiarioCaixa(req, res, next),
  createInternalAuditoriaLog: (req, res, next) => mockCreateInternalAuditoriaLog(req, res, next),
  queryInternalAuditoriaLogs: (req, res, next) => mockQueryInternalAuditoriaLogs(req, res, next)
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

describe('app integration routes', () => {
  let app;
  const basePath = '/pdms-new/mapas';

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
    process.env.BASE_PATH_DEV = basePath;
    process.env.BASE_PATH_PROD = '/pdms/mapas';
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
    expect(response.body.service).toBe('mapas');
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeTruthy();
  });

  test('GET app home redirects to login when web auth fails', async () => {
    mockAuthMode.web = 'deny';

    const response = await request(app).get(`${basePath}/`);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/pdms-new/login');
  });

  test('GET app home renders launcher when web auth passes', async () => {
    const response = await request(app).get(`${basePath}/`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('PDMS Mapas');
  });

  test('GET diario-caixa delegates to controller', async () => {
    const response = await request(app).get(`${basePath}/diario-caixa`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('diario-page');
    expect(mockGetDiarioCaixaPage).toHaveBeenCalledTimes(1);
  });

  test('POST internal route returns 401 when api auth fails', async () => {
    mockAuthMode.api = 'deny';

    const response = await request(app)
      .post(`${basePath}/internal/auditoria/query`)
      .send({ limit: 5 });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('invalid_gateway_session');
    expect(mockQueryInternalAuditoriaLogs).not.toHaveBeenCalled();
  });

  test('POST internal route reaches controller when api auth passes', async () => {
    const response = await request(app)
      .post(`${basePath}/internal/auditoria/query`)
      .send({ limit: 5 });

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('auditoria-query');
    expect(mockQueryInternalAuditoriaLogs).toHaveBeenCalledTimes(1);
  });
});
