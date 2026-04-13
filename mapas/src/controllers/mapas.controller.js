const diarioCaixaDao = require('../daos/diarioCaixa.dao');
const auditoriaLogsDao = require('../daos/auditoriaLogs.dao');
const TABLE_FILTER_EMPTY_TOKEN = '__EMPTY__';
const DIARIO_TABLE_FILTER_KEYS = [
  'data',
  'codigoEntidade',
  'docEntidade',
  'codigoTipo',
  'centroCustos',
  'mapa',
  'creditoDebito',
  'conta'
];
const AUDITORIA_TABLE_FILTER_KEYS = [
  'createdAtDate',
  'tableName',
  'recordId',
  'action',
  'userId'
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeDecimal(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function buildMovimentoPayload(movimento, actor = 'internal-sync') {
  return {
    data: normalizeText(movimento.data),
    codigoEntidade: normalizeText(movimento.codigoEntidade),
    docEntidade: normalizeText(movimento.docEntidade),
    docInterno: normalizeText(movimento.docInterno),
    codigoTipo: normalizeText(movimento.codigoTipo),
    centroCustos: normalizeText(movimento.centroCustos) || null,
    mapa: normalizeText(movimento.mapa),
    recordUuid: normalizeText(movimento.recordUuid || movimento.contagemDinheiroId || movimento.id),
    valor: normalizeDecimal(movimento.valor),
    creditoDebito: normalizeText(movimento.creditoDebito).toUpperCase(),
    conta: normalizeText(movimento.conta),
    createdBy: actor,
    changedBy: actor
  };
}

function isValidMovimentoPayload(payload) {
  return Boolean(
    payload.data
      && payload.codigoEntidade
      && payload.docEntidade
      && payload.docInterno
      && payload.codigoTipo
      && payload.mapa
      && payload.valor !== null
      && payload.creditoDebito
      && payload.conta
  );
}

function parseTableFilterValues(rawValue) {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  const normalized = values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);

  if (normalized.includes(TABLE_FILTER_EMPTY_TOKEN)) {
    return [];
  }

  return Array.from(new Set(normalized));
}

function parseDiarioTableFilters(query = {}) {
  const filters = {};

  DIARIO_TABLE_FILTER_KEYS.forEach((key) => {
    const paramName = `tf${key[0].toUpperCase()}${key.slice(1)}`;
    if (!Object.prototype.hasOwnProperty.call(query, paramName)) {
      return;
    }

    const values = parseTableFilterValues(query[paramName]);
    if (values.length > 0 || (Array.isArray(query[paramName]) && query[paramName].includes(TABLE_FILTER_EMPTY_TOKEN))) {
      filters[key] = values;
      return;
    }

    if (!Array.isArray(query[paramName]) && String(query[paramName] || '').trim() === TABLE_FILTER_EMPTY_TOKEN) {
      filters[key] = [];
    }
  });

  return filters;
}

function parseAuditoriaTableFilters(query = {}) {
  const filters = {};

  AUDITORIA_TABLE_FILTER_KEYS.forEach((key) => {
    const paramName = `tf${key[0].toUpperCase()}${key.slice(1)}`;
    if (!Object.prototype.hasOwnProperty.call(query, paramName)) {
      return;
    }

    const values = parseTableFilterValues(query[paramName]);
    if (values.length > 0 || (Array.isArray(query[paramName]) && query[paramName].includes(TABLE_FILTER_EMPTY_TOKEN))) {
      filters[key] = values;
      return;
    }

    if (!Array.isArray(query[paramName]) && String(query[paramName] || '').trim() === TABLE_FILTER_EMPTY_TOKEN) {
      filters[key] = [];
    }
  });

  return filters;
}

function appendTableFiltersToQueryString(searchParams, tableFilters = {}) {
  Object.entries(tableFilters).forEach(([key, values]) => {
    const paramName = `tf${key[0].toUpperCase()}${key.slice(1)}`;
    if (!Array.isArray(values) || values.length === 0) {
      searchParams.append(paramName, TABLE_FILTER_EMPTY_TOKEN);
      return;
    }

    values.forEach((value) => searchParams.append(paramName, value));
  });
}

async function getDiarioCaixaPage(req, res, next) {
  try {
    const query = req.query || {};
    const requestedPage = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(25, Number.parseInt(query.pageSize, 10) || 50));
    const sortBy = normalizeText(query.sortBy) || 'data';
    const sortDir = normalizeText(query.sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const tableFilters = parseDiarioTableFilters(query);

    const totalRecords = await diarioCaixaDao.count({ tableFilters });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const rows = await diarioCaixaDao.listWithPagination(page, pageSize, {
      sortBy,
      sortDir,
      tableFilters
    });
    const tableFilterOptions = await diarioCaixaDao.listTableFilterOptions(tableFilters);

    if (totalRecords > 0 && requestedPage > totalPages) {
      const redirectQs = new URLSearchParams();
      redirectQs.set('page', String(totalPages));
      redirectQs.set('pageSize', String(pageSize));
      redirectQs.set('sortBy', sortBy);
      redirectQs.set('sortDir', sortDir);
      appendTableFiltersToQueryString(redirectQs, tableFilters);
      return res.redirect(302, `${res.locals.basePath}/diario-caixa?${redirectQs.toString()}`);
    }

    const from = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = totalRecords === 0 ? 0 : Math.min(page * pageSize, totalRecords);

    return res.status(200).render('diario-caixa-list', {
      pageTitle: 'Mapas | Diario de Caixa',
      rows,
      tableFilters,
      tableFilterOptions,
      sortBy,
      sortDir,
      pagination: {
        currentPage: page,
        pageSize,
        totalRecords,
        totalPages,
        from,
        to
      },
      user: req.user
    });
  } catch (error) {
    return next(error);
  }
}

async function getAuditoriaLogsPage(req, res, next) {
  try {
    const q = req.query || {};

    const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(10, Number.parseInt(q.pageSize, 10) || 50));
    const sortBy = normalizeText(q.sortBy) || 'createdAt';
    const sortDir = normalizeText(q.sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const tableFilters = parseAuditoriaTableFilters(q);

    const result = await auditoriaLogsDao.listLogsPaged({
      page,
      pageSize,
      sortBy,
      sortDir,
      tableFilters
    });
    const tableFilterOptions = await auditoriaLogsDao.listTableFilterOptions(tableFilters);

    if (result.total > 0 && page > result.pages) {
      const redirectQs = new URLSearchParams();
      redirectQs.set('page', String(result.pages));
      redirectQs.set('pageSize', String(pageSize));
      redirectQs.set('sortBy', sortBy);
      redirectQs.set('sortDir', sortDir);
      appendTableFiltersToQueryString(redirectQs, tableFilters);
      return res.redirect(302, `${res.locals.basePath}/auditoria-logs?${redirectQs.toString()}`);
    }

    return res.status(200).render('auditoria-logs-list', {
      pageTitle: 'Mapas | Auditoria',
      ...result,
      tableFilters,
      tableFilterOptions,
      sortBy,
      sortDir,
      user: req.user
    });
  } catch (error) {
    return next(error);
  }
}

async function upsertInternalDiarioCaixa(req, res, next) {
  try {
    const movimento = req.body?.movimento || {};
    const actor = normalizeText(req.user?.userName) || normalizeText(req.body?.actor) || 'gateway-session';

    const payload = buildMovimentoPayload(movimento, actor);

    if (!isValidMovimentoPayload(payload)) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Payload de movimento invalido para diario_caixa.'
      });
    }

    const result = await diarioCaixaDao.upsertMovimento(payload);
    return res.status(200).json({ status: 'ok', data: result });
  } catch (error) {
    return next(error);
  }
}

async function checkInternalDiarioCaixa(req, res, next) {
  try {
    const rawMovimentos = Array.isArray(req.body?.movimentos) ? req.body.movimentos : [];
    const movimentos = rawMovimentos.map((movimento) => buildMovimentoPayload(movimento));

    if (movimentos.length === 0 || movimentos.some((movimento) => !isValidMovimentoPayload(movimento))) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Payload de movimentos invalido para diario_caixa.'
      });
    }

    const data = await diarioCaixaDao.checkMovimentosExistence(movimentos);
    return res.status(200).json({ status: 'ok', data });
  } catch (error) {
    return next(error);
  }
}

async function createInternalAuditoriaLog(req, res, next) {
  try {
    const payload = req.body || {};
    const actor = normalizeText(req.user?.userName) || normalizeText(payload?.actor) || 'gateway-session';

    if (!payload.action || !payload.tableName) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Campos obrigatorios em falta para auditoria (action/tableName).'
      });
    }

    const result = await auditoriaLogsDao.createLog({
      userId: normalizeText(req.user?.id) || normalizeText(payload.userId),
      action: normalizeText(payload.action),
      tableName: normalizeText(payload.tableName),
      recordId: normalizeText(payload.recordId),
      payload: {
        before: payload.before || null,
        after: payload.after || null,
        meta: {
          ...(payload.meta || {}),
          actor
        }
      }
    });

    return res.status(200).json({ status: 'ok', data: result });
  } catch (error) {
    return next(error);
  }
}

async function queryInternalAuditoriaLogs(req, res, next) {
  try {
    const payload = req.body || {};
    const limit = Number.parseInt(String(payload.limit || '100'), 10);

    const rows = await auditoriaLogsDao.listLogs({
      tableName: normalizeText(payload.tableName) || undefined,
      recordId: normalizeText(payload.recordId) || undefined,
      userId: normalizeText(payload.userId) || undefined,
      limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100
    });

    return res.status(200).json({ status: 'ok', data: rows });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upsertInternalDiarioCaixa,
  checkInternalDiarioCaixa,
  createInternalAuditoriaLog,
  queryInternalAuditoriaLogs,
  getDiarioCaixaPage,
  getAuditoriaLogsPage
};
