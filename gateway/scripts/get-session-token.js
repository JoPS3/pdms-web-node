#!/usr/bin/env node

require('dotenv').config();

const mysql = require('mysql2/promise');

function maskToken(token) {
  const value = String(token || '');
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

async function run() {
  const userName = String(process.env.USER_NAME || process.argv[2] || '').trim();
  const onlyValid = String(process.env.ONLY_VALID || '1').trim() !== '0';
  const showRaw = String(process.env.SHOW_RAW || '').trim() === '1';

  if (!userName) {
    throw new Error('USER_NAME em falta. Exemplo: USER_NAME=admin npm run get:session-token');
  }

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pedaco-000'
  };

  const connection = await mysql.createConnection(dbConfig);
  try {
    const sql = `
      SELECT
        s.session_token,
        s.expires_at,
        s.is_valid,
        s.created_at,
        u.user_name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE u.user_name = ?
        AND s.is_deleted = 0
        ${onlyValid ? 'AND s.is_valid = 1 AND s.expires_at > NOW()' : ''}
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    const [rows] = await connection.execute(sql, [userName]);
    if (!rows.length) {
      throw new Error('Nenhuma sessao encontrada para esse utilizador com os filtros atuais.');
    }

    const row = rows[0];
    const token = String(row.session_token || '');

    console.log('--- Session Token Lookup ---');
    console.log(`user_name: ${row.user_name}`);
    console.log(`expires_at: ${new Date(row.expires_at).toISOString()}`);
    console.log(`is_valid: ${row.is_valid}`);
    console.log(`session_token_masked: ${maskToken(token)}`);

    if (showRaw) {
      console.log(`session_token_raw: ${token}`);
    }

    console.log(`export SESSION_TOKEN=${token}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
});
