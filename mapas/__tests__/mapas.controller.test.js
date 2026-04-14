jest.mock('../src/daos/diarioCaixa.dao', () => ({
  count: jest.fn(),
  listWithPagination: jest.fn(),
  listTableFilterOptions: jest.fn(),
  upsertMovimento: jest.fn(),
  checkMovimentosExistence: jest.fn()
}));

jest.mock('../src/daos/auditoriaLogs.dao', () => ({
  listLogsPaged: jest.fn(),
  listTableFilterOptions: jest.fn(),
  createLog: jest.fn(),
  listLogs: jest.fn()
}));

const diarioCaixaDao = require('../src/daos/diarioCaixa.dao');
const auditoriaLogsDao = require('../src/daos/auditoriaLogs.dao');
const mapasController = require('../src/controllers/mapas.controller');

function createResMock(basePath = '/pdms-new/mapas') {
  const res = {
    locals: { basePath },
    status: jest.fn(),
    render: jest.fn(),
    redirect: jest.fn(),
    json: jest.fn()
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('mapas.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDiarioCaixaPage applies default year when ano is invalid', async () => {
    diarioCaixaDao.count.mockResolvedValue(1);
    diarioCaixaDao.listWithPagination.mockResolvedValue([{ id: 'r1' }]);
    diarioCaixaDao.listTableFilterOptions.mockResolvedValue({ data: [] });

    const req = {
      query: { ano: 'invalid' },
      user: { role: 'ADMINISTRADOR', userName: 'admin' }
    };
    const res = createResMock();
    const next = jest.fn();

    await mapasController.getDiarioCaixaPage(req, res, next);

    expect(diarioCaixaDao.count).toHaveBeenCalledTimes(1);
    const callOptions = diarioCaixaDao.count.mock.calls[0][0];
    expect(callOptions.ano).toBe(new Date().getFullYear());
    expect(res.render).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test('getAuditoriaLogsPage applies default current period when periodo is invalid', async () => {
    auditoriaLogsDao.listLogsPaged.mockResolvedValue({
      rows: [],
      total: 0,
      totalPeriodo: 0,
      page: 1,
      pageSize: 50,
      pages: 1
    });
    auditoriaLogsDao.listTableFilterOptions.mockResolvedValue({ createdAtDate: [] });

    const req = {
      query: { periodo: '2026-99' },
      user: { role: 'ADMINISTRADOR', userName: 'admin' }
    };
    const res = createResMock();
    const next = jest.fn();

    await mapasController.getAuditoriaLogsPage(req, res, next);

    expect(auditoriaLogsDao.listLogsPaged).toHaveBeenCalledTimes(1);
    const options = auditoriaLogsDao.listLogsPaged.mock.calls[0][0];
    expect(options.periodo).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(res.render).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test('protected page returns 403 for non-admin users', async () => {
    const req = {
      query: {},
      user: { role: 'USER' }
    };
    const res = createResMock();
    const next = jest.fn();

    await mapasController.getDiarioCaixaPage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({
      title: 'Sem privilégios'
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
