const { query } = require('../db/mysql');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDITORIA_SORT_FIELDS = {
  createdAt: 'created_at',
  tableName: 'nome_tabela',
  recordId: 'registo_id',
  action: 'acao',
  userId: 'user_id'
};

const AUDITORIA_FILTER_COLUMNS = {
  createdAtDate: "DATE_FORMAT(created_at, '%Y-%m-%d')",
  tableName: 'nome_tabela',
  recordId: 'LOWER(registo_id)',
  action: 'acao',
  userId: 'LOWER(user_id)'
};

function buildPeriodoBounds(periodo) {
  const value = String(periodo || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return null;
  }

  const [yearRaw, monthRaw] = value.split('-').map((entry) => Number.parseInt(entry, 10));
  const nextMonth = monthRaw === 12 ? 1 : monthRaw + 1;
  const nextYear = monthRaw === 12 ? yearRaw + 1 : yearRaw;

  const start = `${String(yearRaw).padStart(4, '0')}-${String(monthRaw).padStart(2, '0')}-01 00:00:00`;
  const end = `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`;

  return { start, end };
}

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return UUID_RE.test(normalized) ? normalized : '';
}

async function createLog(entry) {
  const userId = normalizeUuid(entry.userId);
  const recordId = normalizeUuid(entry.recordId);

  if (!userId) {
    const error = new Error('userId invalido para auditoria. Esperado UUID.');
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  if (!recordId) {
    const error = new Error('recordId invalido para auditoria. Esperado UUID.');
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  await query(
    `
      INSERT INTO auditoria_logs (
        id,
        user_id,
        acao,
        nome_tabela,
        registo_id,
        payload_alteracoes
      ) VALUES (UUID_V7(), ?, ?, ?, ?, ?)
    `,
    [
      userId,
      String(entry.action || '').trim(),
      String(entry.tableName || '').trim(),
      recordId,
      JSON.stringify(entry.payload || {})
    ]
  );

  const rows = await query(
    `
      SELECT LOWER(id) AS id
      FROM auditoria_logs
      WHERE user_id = ?
        AND nome_tabela = ?
        AND registo_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [userId, String(entry.tableName || '').trim(), recordId]
  );

  return { id: rows[0]?.id || null };
}

async function listLogs(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.tableName) {
    conditions.push('nome_tabela = ?');
    params.push(filters.tableName);
  }

  if (filters.recordId) {
    conditions.push('registo_id = ?');
    params.push(String(filters.recordId));
  }

  if (filters.userId) {
    conditions.push('user_id = ?');
    params.push(String(filters.userId).trim().toLowerCase());
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Number.isInteger(filters.limit) ? filters.limit : 100;

  return query(
    `
      SELECT
        LOWER(id) AS id,
        LOWER(user_id) AS userId,
        acao AS action,
        nome_tabela AS tableName,
        LOWER(registo_id) AS recordId,
        payload_alteracoes AS payload,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM auditoria_logs
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [...params, limit]
  );
}

async function listLogsPaged(filters = {}) {
  const tableFilters = filters.tableFilters || {};
  const periodo = String(filters.periodo || '').trim();
  const sortBy = String(filters.sortBy || 'createdAt');
  const sortDir = String(filters.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const sortColumn = AUDITORIA_SORT_FIELDS[sortBy] || AUDITORIA_SORT_FIELDS.createdAt;

  const normalizeFilterValues = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return Array.from(
      new Set(
        value
          .map((entry) => String(entry ?? '').trim())
          .filter((entry) => entry.length > 0)
      )
    );
  };

  const normalizedTableFilters = {};
  Object.keys(AUDITORIA_FILTER_COLUMNS).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(tableFilters, key)) {
      return;
    }

    if (Array.isArray(tableFilters[key]) && tableFilters[key].length === 0) {
      normalizedTableFilters[key] = [];
      return;
    }

    const values = normalizeFilterValues(tableFilters[key]);
    if (values.length > 0) {
      normalizedTableFilters[key] = values;
    }
  });

  const buildWhereClause = (ignoredKey = null, includeTableFilters = true) => {
    const conditions = [];
    const params = [];

    const periodoBounds = buildPeriodoBounds(periodo);
    if (periodoBounds) {
      conditions.push('created_at >= ? AND created_at < ?');
      params.push(periodoBounds.start, periodoBounds.end);
    }

    if (!includeTableFilters) {
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      return { whereClause, params };
    }

    Object.entries(AUDITORIA_FILTER_COLUMNS).forEach(([key, columnExpr]) => {
      if (ignoredKey === key || !Object.prototype.hasOwnProperty.call(normalizedTableFilters, key)) {
        return;
      }

      const values = normalizedTableFilters[key];
      if (!Array.isArray(values)) {
        return;
      }

      if (values.length === 0) {
        conditions.push('1 = 0');
        return;
      }

      const placeholders = values.map(() => '?').join(', ');
      conditions.push(`${columnExpr} IN (${placeholders})`);
      params.push(...values);
    });

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  };

  const { whereClause, params } = buildWhereClause();
  const { whereClause: periodWhereClause, params: periodParams } = buildWhereClause(null, false);

  const pageSize = Number.isInteger(filters.pageSize) && filters.pageSize > 0
    ? Math.min(filters.pageSize, 200)
    : 50;
  const page = Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const offset = (page - 1) * pageSize;

  const [countFilteredResult, countPeriodoResult, rows] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total FROM auditoria_logs ${whereClause}`,
      [...params]
    ),
    query(
      `SELECT COUNT(*) AS total FROM auditoria_logs ${periodWhereClause}`,
      [...periodParams]
    ),
    query(
      `
        SELECT
          LOWER(id) AS id,
          LOWER(user_id) AS userId,
          acao AS action,
          nome_tabela AS tableName,
          LOWER(registo_id) AS recordId,
          payload_alteracoes AS payload,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM auditoria_logs
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDir}, id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    )
  ]);

  const total = Number(countFilteredResult[0]?.total ?? 0);
  const totalPeriodo = Number(countPeriodoResult[0]?.total ?? 0);

  return {
    rows,
    total,
    totalPeriodo,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize) || 1
  };
}

async function listTableFilterOptions(tableFilters = {}, periodo = '') {
  const normalizedPeriodo = String(periodo || '').trim();
  const normalizeFilterValues = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return Array.from(
      new Set(
        value
          .map((entry) => String(entry ?? '').trim())
          .filter((entry) => entry.length > 0)
      )
    );
  };

  const normalizedTableFilters = {};
  Object.keys(AUDITORIA_FILTER_COLUMNS).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(tableFilters, key)) {
      return;
    }

    if (Array.isArray(tableFilters[key]) && tableFilters[key].length === 0) {
      normalizedTableFilters[key] = [];
      return;
    }

    const values = normalizeFilterValues(tableFilters[key]);
    if (values.length > 0) {
      normalizedTableFilters[key] = values;
    }
  });

  const buildWhereClause = (ignoredKey = null) => {
    const conditions = [];
    const params = [];

    const periodoBounds = buildPeriodoBounds(normalizedPeriodo);
    if (periodoBounds) {
      conditions.push('created_at >= ? AND created_at < ?');
      params.push(periodoBounds.start, periodoBounds.end);
    }

    Object.entries(AUDITORIA_FILTER_COLUMNS).forEach(([key, columnExpr]) => {
      if (ignoredKey === key || !Object.prototype.hasOwnProperty.call(normalizedTableFilters, key)) {
        return;
      }

      const values = normalizedTableFilters[key];
      if (!Array.isArray(values)) {
        return;
      }

      if (values.length === 0) {
        conditions.push('1 = 0');
        return;
      }

      const placeholders = values.map(() => '?').join(', ');
      conditions.push(`${columnExpr} IN (${placeholders})`);
      params.push(...values);
    });

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  };

  const entries = await Promise.all(
    Object.entries(AUDITORIA_FILTER_COLUMNS).map(async ([key, columnExpr]) => {
      const { whereClause, params } = buildWhereClause(key);
      const rows = await query(
        `
          SELECT DISTINCT ${columnExpr} AS value
          FROM auditoria_logs
          ${whereClause}
          ORDER BY value ASC
        `,
        params
      );

      const normalizedRows = rows
        .map((row) => {
          const value = String(row?.value ?? '').trim();
          return { value, label: value };
        })
        .filter((entry) => entry.value.length > 0);

      return [key, normalizedRows];
    })
  );

  return Object.fromEntries(entries);
}

module.exports = {
  createLog,
  listLogs,
  listLogsPaged,
  listTableFilterOptions
};
