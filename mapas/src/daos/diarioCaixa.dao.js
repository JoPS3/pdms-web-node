const crypto = require('crypto');
const { query } = require('../db/mysql');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOC_INTERNO_UUID_SUFFIX_PATTERN = /\s*\[[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\]\s*$/i;
const DIARIO_SORT_FIELDS = {
  data: 'diario_caixa.data',
  codigoEntidade: 'diario_caixa.codigo_entidade',
  docEntidade: 'diario_caixa.doc_entidade',
  docInterno: 'diario_caixa.doc_interno',
  codigoTipo: 'diario_caixa.codigo_tipo',
  centroCustos: 'diario_caixa.centro_custos',
  mapa: 'diario_caixa.mapa',
  valor: 'diario_caixa.valor',
  creditoDebito: 'diario_caixa.credito_debito',
  conta: 'diario_caixa.conta',
  createdAt: 'diario_caixa.created_at'
};

const DIARIO_FILTER_COLUMNS = {
  data: "DATE_FORMAT(diario_caixa.data, '%Y-%m-%d')",
  codigoEntidade: 'diario_caixa.codigo_entidade',
  docEntidade: 'diario_caixa.doc_entidade',
  codigoTipo: 'diario_caixa.codigo_tipo',
  centroCustos: "COALESCE(diario_caixa.centro_custos, '')",
  mapa: 'diario_caixa.mapa',
  creditoDebito: 'diario_caixa.credito_debito',
  conta: 'diario_caixa.conta'
};

function normalizeUuid(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return '';
  }
  return normalized;
}

function stripDocInternoUuidSuffix(value) {
  return String(value ?? '').replace(DOC_INTERNO_UUID_SUFFIX_PATTERN, '').trim();
}

function asUuidFromHash(hashHex) {
  const hex = String(hashHex || '').slice(0, 32).padEnd(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildDeterministicRecordUuid(payload, baseDocInterno) {
  const hash = crypto
    .createHash('md5')
    .update([
      payload.data,
      payload.codigoEntidade,
      payload.docEntidade,
      baseDocInterno,
      payload.codigoTipo,
      payload.centroCustos ?? '',
      payload.mapa,
      payload.creditoDebito,
      payload.conta
    ].map((value) => String(value ?? '').trim()).join('|'))
    .digest('hex');

  return asUuidFromHash(hash);
}

function normalizePayloadForStorage(payload) {
  const baseDocInterno = stripDocInternoUuidSuffix(payload.docInterno);
  const recordUuid = normalizeUuid(payload.recordUuid) || buildDeterministicRecordUuid(payload, baseDocInterno);
  const taggedDocInterno = `${baseDocInterno}[${recordUuid}]`;

  return {
    ...payload,
    docInternoBase: baseDocInterno,
    docInternoTagged: taggedDocInterno,
    recordUuid
  };
}

function normalizeRowForOutput(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  return {
    ...row,
    doc_interno: stripDocInternoUuidSuffix(row.doc_interno)
  };
}

const latestMovimentosSubquery = `
  SELECT
    id,
    data,
    codigo_entidade,
    doc_entidade,
    doc_interno,
    codigo_tipo,
    centro_custos,
    mapa,
    valor,
    credito_debito,
    conta,
    created_at,
    changed_at
  FROM diario_caixa
`;

async function listLatest(limit = 100) {
  const rows = await query(
    `
      SELECT
        id,
        DATE_FORMAT(data, '%Y-%m-%d') AS data,
        codigo_entidade,
        doc_entidade,
        doc_interno,
        codigo_tipo,
        centro_custos,
        mapa,
        valor,
        credito_debito,
        conta,
        created_at
      FROM (${latestMovimentosSubquery}) diario_caixa
      ORDER BY data DESC, created_at DESC
      LIMIT ?
    `,
    [limit]
  );

  return rows.map(normalizeRowForOutput);
}

function normalizeTableFilters(rawFilters = {}) {
  const normalized = {};

  Object.keys(DIARIO_FILTER_COLUMNS).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(rawFilters, key)) {
      return;
    }

    const values = Array.isArray(rawFilters[key])
      ? rawFilters[key].map((value) => String(value ?? '').trim()).filter(Boolean)
      : [];

    if (Array.isArray(rawFilters[key]) && rawFilters[key].length === 0) {
      normalized[key] = [];
      return;
    }

    if (values.length > 0) {
      normalized[key] = Array.from(new Set(values));
    }
  });

  return normalized;
}

function buildTableFiltersWhereClause(tableFilters = {}, ignoredKey = null, ano = null) {
  const normalizedFilters = normalizeTableFilters(tableFilters);
  const whereParts = [];
  const params = [];

  if (ano !== null && Number.isFinite(ano)) {
    whereParts.push('YEAR(diario_caixa.data) = ?');
    params.push(ano);
  }

  Object.entries(DIARIO_FILTER_COLUMNS).forEach(([key, columnExpr]) => {
    if (key === ignoredKey || !Object.prototype.hasOwnProperty.call(normalizedFilters, key)) {
      return;
    }

    const values = normalizedFilters[key];
    if (!Array.isArray(values)) {
      return;
    }

    if (values.length === 0) {
      whereParts.push('1 = 0');
      return;
    }

    const placeholders = values.map(() => '?').join(', ');
    whereParts.push(`${columnExpr} IN (${placeholders})`);
    params.push(...values);
  });

  return {
    whereClause: whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '',
    params
  };
}

async function count(options = {}) {
  const tableFilters = options.tableFilters || {};
  const ano = options.ano || null;
  const { whereClause, params } = buildTableFiltersWhereClause(tableFilters, null, ano);
  const result = await query(
    `SELECT COUNT(*) as total FROM (${latestMovimentosSubquery}) diario_caixa ${whereClause}`,
    params
  );
  return result[0]?.total || 0;
}

async function listWithPagination(page = 1, pageSize = 50, options = {}) {
  const offset = (page - 1) * pageSize;
  const sortBy = String(options.sortBy || 'data');
  const sortDir = String(options.sortDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const sortColumn = DIARIO_SORT_FIELDS[sortBy] || DIARIO_SORT_FIELDS.data;
  const tableFilters = options.tableFilters || {};
  const ano = options.ano || null;
  const { whereClause, params } = buildTableFiltersWhereClause(tableFilters, null, ano);
  const rows = await query(
    `
      SELECT
        id,
        DATE_FORMAT(data, '%Y-%m-%d') AS data,
        codigo_entidade,
        doc_entidade,
        doc_interno,
        codigo_tipo,
        centro_custos,
        mapa,
        valor,
        credito_debito,
        conta,
        created_at
      FROM (${latestMovimentosSubquery}) diario_caixa
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}, diario_caixa.id ASC
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  );

  return rows.map(normalizeRowForOutput);
}

async function listTableFilterOptions(tableFilters = {}, ano = null) {
  const optionEntries = await Promise.all(
    Object.entries(DIARIO_FILTER_COLUMNS).map(async ([key, columnExpr]) => {
      const { whereClause, params } = buildTableFiltersWhereClause(tableFilters, key, ano);
      const rows = await query(
        `
          SELECT DISTINCT ${columnExpr} AS value
          FROM (${latestMovimentosSubquery}) diario_caixa
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

  return Object.fromEntries(optionEntries);
}

async function createOne(payload) {
  const normalizedPayload = normalizePayloadForStorage(payload);
  const sql = `
    INSERT INTO diario_caixa (
      data,
      codigo_entidade,
      doc_entidade,
      doc_interno,
      codigo_tipo,
      centro_custos,
      mapa,
      valor,
      credito_debito,
      conta,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [
    normalizedPayload.data,
    normalizedPayload.codigoEntidade,
    normalizedPayload.docEntidade,
    normalizedPayload.docInternoTagged,
    normalizedPayload.codigoTipo,
    normalizedPayload.centroCustos,
    normalizedPayload.mapa,
    normalizedPayload.valor,
    normalizedPayload.creditoDebito,
    normalizedPayload.conta,
    normalizedPayload.createdBy
  ]);

  return result.affectedRows;
}

async function upsertMovimento(payload) {
  const normalizedPayload = normalizePayloadForStorage(payload);
  const lookupSql = `
    SELECT id
    FROM diario_caixa
    WHERE data = ?
      AND codigo_entidade = ?
      AND doc_entidade = ?
      AND (doc_interno = ? OR doc_interno = ?)
      AND codigo_tipo = ?
      AND centro_custos <=> ?
      AND mapa = ?
      AND credito_debito = ?
      AND conta = ?
    ORDER BY changed_at DESC, created_at DESC
    LIMIT 1
  `;

  const lookupRows = await query(lookupSql, [
    normalizedPayload.data,
    normalizedPayload.codigoEntidade,
    normalizedPayload.docEntidade,
    normalizedPayload.docInternoTagged,
    normalizedPayload.docInternoBase,
    normalizedPayload.codigoTipo,
    normalizedPayload.centroCustos,
    normalizedPayload.mapa,
    normalizedPayload.creditoDebito,
    normalizedPayload.conta
  ]);

  const existingId = lookupRows[0]?.id;
  if (existingId) {
    if (normalizedPayload.valor === 0) {
      await query(
        `
          DELETE FROM diario_caixa
          WHERE id = ?
        `,
        [existingId]
      );

      return { action: 'deleted', id: existingId };
    }

    await query(
      `
        UPDATE diario_caixa
        SET
          valor = ?,
          changed_at = NOW(),
          changed_by = ?
        WHERE id = ?
      `,
      [normalizedPayload.valor, normalizedPayload.changedBy, existingId]
    );

    return { action: 'updated', id: existingId };
  }

  if (normalizedPayload.valor === 0) {
    return { action: 'deleted' };
  }

  await query(
    `
      INSERT INTO diario_caixa (
        data,
        codigo_entidade,
        doc_entidade,
        doc_interno,
        codigo_tipo,
        centro_custos,
        mapa,
        valor,
        credito_debito,
        conta,
        created_by,
        changed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      normalizedPayload.data,
      normalizedPayload.codigoEntidade,
      normalizedPayload.docEntidade,
      normalizedPayload.docInternoTagged,
      normalizedPayload.codigoTipo,
      normalizedPayload.centroCustos,
      normalizedPayload.mapa,
      normalizedPayload.valor,
      normalizedPayload.creditoDebito,
      normalizedPayload.conta,
      normalizedPayload.createdBy,
      normalizedPayload.changedBy
    ]
  );

  return { action: 'inserted' };
}

async function existsMovimento(payload) {
  const normalizedPayload = normalizePayloadForStorage(payload);
  const rows = await query(
    `
      SELECT 1
      FROM diario_caixa
      WHERE data = ?
        AND codigo_entidade = ?
        AND doc_entidade = ?
        AND (doc_interno = ? OR doc_interno = ?)
        AND codigo_tipo = ?
        AND centro_custos <=> ?
        AND mapa = ?
        AND valor = ?
        AND credito_debito = ?
        AND conta = ?
      LIMIT 1
    `,
    [
      normalizedPayload.data,
      normalizedPayload.codigoEntidade,
      normalizedPayload.docEntidade,
      normalizedPayload.docInternoTagged,
      normalizedPayload.docInternoBase,
      normalizedPayload.codigoTipo,
      normalizedPayload.centroCustos,
      normalizedPayload.mapa,
      normalizedPayload.valor,
      normalizedPayload.creditoDebito,
      normalizedPayload.conta
    ]
  );

  return rows.length > 0;
}

async function checkMovimentosExistence(movimentos = []) {
  const checks = await Promise.all(movimentos.map((movimento) => existsMovimento(movimento)));
  return checks.map((exists, index) => ({ index, exists }));
}

module.exports = {
  listLatest,
  count,
  listWithPagination,
  listTableFilterOptions,
  createOne,
  upsertMovimento,
  checkMovimentosExistence
};
