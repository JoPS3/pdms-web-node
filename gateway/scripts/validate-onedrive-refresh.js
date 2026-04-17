#!/usr/bin/env node

require('dotenv').config();

const mysql = require('mysql2/promise');
const http = require('http');
const https = require('https');

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function ensureTrailingSlashless(input) {
  return String(input || '').replace(/\/+$/, '');
}

function ensureLeadingSlash(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  return value.startsWith('/') ? value : `/${value}`;
}

function parseBoolean(input) {
  const normalized = String(input || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getStatusUrl() {
  const explicit = String(process.env.OD_STATUS_URL || '').trim();
  if (explicit) {
    return explicit;
  }

  const baseUrl = ensureTrailingSlashless(process.env.GATEWAY_BASE_URL || 'http://localhost:6000');
  const basePath = ensureLeadingSlash(
    process.env.GATEWAY_BASE_PATH || process.env.BASE_PATH_DEV || process.env.BASE_PATH_PROD || '/pdms-new'
  );
  return `${baseUrl}${basePath}/internal/onedrive/status`;
}

async function getUserIdBySession(connection, sessionToken) {
  const sql = `
    SELECT s.user_id
    FROM sessions s
    WHERE s.session_token = ?
      AND s.is_deleted = 0
      AND s.is_valid = 1
    ORDER BY s.created_at DESC
    LIMIT 1
  `;

  const [rows] = await connection.execute(sql, [sessionToken]);
  return rows[0]?.user_id || null;
}

async function getCurrentOneDriveTokenRow(connection, userId) {
  const sql = `
    SELECT
      c.id AS connection_id,
      c.status,
      t.id AS token_id,
      t.access_expires_at,
      t.changed_at
    FROM onedrive_connections c
    LEFT JOIN onedrive_tokens t
      ON t.connection_id = c.id
      AND t.is_deleted = 0
    WHERE c.owner_user_id = ?
      AND c.provider = 'onedrive'
      AND c.is_deleted = 0
    ORDER BY c.created_at DESC
    LIMIT 1
  `;

  const [rows] = await connection.execute(sql, [userId]);
  return rows[0] || null;
}

async function forceAccessTokenExpired(connection, tokenId, forceMinutes) {
  const safeMinutes = Number.isFinite(forceMinutes) && forceMinutes > 0 ? Math.floor(forceMinutes) : 5;

  const sql = `
    UPDATE onedrive_tokens
    SET access_expires_at = DATE_SUB(NOW(), INTERVAL ${safeMinutes} MINUTE),
        changed_at = NOW(),
        changed_by = 'onedrive-refresh-validator'
    WHERE id = ?
      AND is_deleted = 0
  `;

  const [result] = await connection.execute(sql, [tokenId]);
  return result?.affectedRows || 0;
}

async function callOneDriveStatus(statusUrl, sessionToken) {
  const request = (url) => new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(parsed, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        Accept: 'application/json'
      }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let body = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch (_error) {
          body = { raw };
        }

        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          body,
          url
        });
      });
    });

    req.on('error', reject);
    req.end();
  });

  try {
    return await request(statusUrl);
  } catch (error) {
    if (!statusUrl.includes('://localhost')) {
      throw error;
    }

    const fallbackUrl = statusUrl.replace('://localhost', '://127.0.0.1');
    return request(fallbackUrl);
  };
}

async function run() {
  const sessionToken = String(process.env.SESSION_TOKEN || '').trim();
  if (!sessionToken) {
    throw new Error('SESSION_TOKEN em falta. Exemplo: SESSION_TOKEN=... npm run validate:onedrive-refresh');
  }

  const readOnly = process.argv.includes('--read-only') || parseBoolean(process.env.OD_READ_ONLY);

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pedaco-000'
  };

  const forceMinutes = Number(process.env.OD_FORCE_EXPIRED_MINUTES || 5);
  const statusUrl = getStatusUrl();

  console.log('--- OneDrive Refresh Validator ---');
  console.log(`Mode: ${readOnly ? 'read-only' : 'active-refresh-check'}`);
  console.log(`DB: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  console.log(`Status URL: ${statusUrl}`);

  const connection = await mysql.createConnection(dbConfig);
  try {
    const userId = await getUserIdBySession(connection, sessionToken);
    if (!userId) {
      throw new Error('Sessao nao encontrada/valida no DB para o SESSION_TOKEN informado.');
    }

    const before = await getCurrentOneDriveTokenRow(connection, userId);
    if (!before?.token_id) {
      throw new Error('Ligacao OneDrive ativa com token nao encontrada para este utilizador.');
    }

    console.log(`Utilizador: ${userId}`);
    console.log(`Antes -> token_id: ${before.token_id}, access_expires_at: ${toIso(before.access_expires_at)}, status: ${before.status}`);

    if (readOnly) {
      const statusCall = await callOneDriveStatus(statusUrl, sessionToken);
      if (!statusCall.ok) {
        throw new Error(`Chamada ao status falhou (${statusCall.status}): ${JSON.stringify(statusCall.body)}`);
      }

      const afterReadOnly = await getCurrentOneDriveTokenRow(connection, userId);
      console.log(
        `Depois (read-only) -> token_id: ${afterReadOnly?.token_id || null}, access_expires_at: ${toIso(afterReadOnly?.access_expires_at)}, status: ${afterReadOnly?.status || null}`
      );
      console.log(`API status -> connected: ${statusCall.body?.onedrive?.connected}, expiresAt: ${statusCall.body?.onedrive?.expiresAt || null}`);
      console.log('Resultado: OK (read-only). Nenhuma alteracao direta foi feita na base de dados por este script.');
      return;
    }

    const updated = await forceAccessTokenExpired(connection, before.token_id, forceMinutes);
    if (!updated) {
      throw new Error('Falha ao forcar expiracao do access token (nenhuma linha atualizada).');
    }

    const statusCall = await callOneDriveStatus(statusUrl, sessionToken);
    if (!statusCall.ok) {
      throw new Error(`Chamada ao status falhou (${statusCall.status}): ${JSON.stringify(statusCall.body)}`);
    }

    const after = await getCurrentOneDriveTokenRow(connection, userId);
    if (!after?.token_id) {
      throw new Error('Nao foi possivel obter estado do token apos refresh.');
    }

    const tokenReplaced = before.token_id !== after.token_id;
    const serverSaysConnected = Boolean(statusCall.body?.onedrive?.connected);

    console.log(`Depois -> token_id: ${after.token_id}, access_expires_at: ${toIso(after.access_expires_at)}, status: ${after.status}`);
    console.log(`API status -> connected: ${statusCall.body?.onedrive?.connected}, expiresAt: ${statusCall.body?.onedrive?.expiresAt || null}`);

    if (!tokenReplaced || !serverSaysConnected) {
      throw new Error(
        `Validacao inconclusiva. token_replaced=${tokenReplaced}, connected=${serverSaysConnected}. ` +
        'Verifica logs do gateway e validade/revogacao do refresh token no tenant.'
      );
    }

    console.log('Resultado: OK. Refresh token renovou o access token automaticamente no backend.');
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
});
