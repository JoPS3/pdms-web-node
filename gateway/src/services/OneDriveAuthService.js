const crypto = require('crypto');
const OneDriveDAO = require('../daos/OneDriveDAO');
const OneDriveSettingsDAO = require('../daos/OneDriveSettingsDAO');

function encodeBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getTokenEncryptionKey() {
  const raw = String(process.env.ONEDRIVE_TOKENS_ENC_KEY || '').trim();
  if (!raw) {
    return null;
  }

  const asBase64 = Buffer.from(raw, 'base64');
  if (asBase64.length === 32) {
    return asBase64;
  }

  const asUtf8 = Buffer.from(raw, 'utf8');
  if (asUtf8.length === 32) {
    return asUtf8;
  }

  return getSettingsEncryptionKey();
}

function getSettingsEncryptionKey() {
  const explicit = String(process.env.ONEDRIVE_SETTINGS_ENC_KEY || '').trim();
  if (explicit) {
    const asBase64 = Buffer.from(explicit, 'base64');
    if (asBase64.length === 32) {
      return asBase64;
    }

    const asUtf8 = Buffer.from(explicit, 'utf8');
    if (asUtf8.length === 32) {
      return asUtf8;
    }
  }

  const sessionSecret = String(process.env.SESSION_SECRET || '').trim();
  if (!sessionSecret) {
    return null;
  }

  return crypto.createHash('sha256').update(sessionSecret).digest();
}

function encryptSecret(plainText) {
  const key = getTokenEncryptionKey();
  if (!key) {
    throw new Error('ONEDRIVE_TOKENS_ENC_KEY ausente ou invalida (32 bytes).');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${encodeBase64Url(iv)}.${encodeBase64Url(tag)}.${encodeBase64Url(encrypted)}`;
}

function encryptSettingsSecret(plainText) {
  const key = getSettingsEncryptionKey();
  if (!key) {
    throw new Error('Chave de cifra de setup OneDrive indisponivel. Configure SESSION_SECRET.');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${encodeBase64Url(iv)}.${encodeBase64Url(tag)}.${encodeBase64Url(encrypted)}`;
}

function decodeBase64Url(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function decryptSettingsSecret(payload) {
  const key = getSettingsEncryptionKey();
  if (!key) {
    throw new Error('Chave de cifra de setup OneDrive indisponivel. Configure SESSION_SECRET.');
  }

  const [ivB64, tagB64, encryptedB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    return '';
  }

  const iv = decodeBase64Url(ivB64);
  const tag = decodeBase64Url(tagB64);
  const encrypted = decodeBase64Url(encryptedB64);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}

function decryptSecret(payload) {
  const key = getTokenEncryptionKey();
  if (!key) {
    throw new Error('ONEDRIVE_TOKENS_ENC_KEY ausente ou invalida (32 bytes).');
  }

  const [ivB64, tagB64, encryptedB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    return '';
  }

  const iv = decodeBase64Url(ivB64);
  const tag = decodeBase64Url(tagB64);
  const encrypted = decodeBase64Url(encryptedB64);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}

function isTokenExpiringSoon(expiresAt) {
  if (!expiresAt) {
    return true;
  }

  const now = Date.now();
  const thresholdMs = 2 * 60 * 1000;
  return expiresAt.getTime() <= (now + thresholdMs);
}

function sanitizeModuleName(value) {
  const normalized = String(value || 'geral').trim().toLowerCase();
  const safe = normalized.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe || 'geral';
}

function formatUtcDateParts(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');

  return {
    year: String(year),
    month,
    day,
    stamp: `${year}${month}${day}-${hour}${minute}${second}`
  };
}

function encodePathSegments(pathSegments) {
  return pathSegments.map((segment) => encodeURIComponent(String(segment))).join('/');
}

function buildRedirectUri() {
  const explicit = String(process.env.ONEDRIVE_REDIRECT_URI || '').trim();
  if (explicit) {
    return explicit;
  }

  const publicBase = String(process.env.GATEWAY_PUBLIC_BASE_URL || '').trim();
  const basePath = String(process.env.NODE_ENV === 'development'
    ? process.env.BASE_PATH_DEV
    : process.env.BASE_PATH_PROD).trim();

  if (!publicBase || !basePath) {
    return '';
  }

  return `${publicBase}${basePath}/internal/onedrive/callback`;
}

async function getResolvedConfig() {
  const dbSettings = await OneDriveSettingsDAO.getSettings();

  const envClientId = String(process.env.ONEDRIVE_CLIENT_ID || '').trim();
  const envClientSecret = String(process.env.ONEDRIVE_CLIENT_SECRET || '').trim();
  const envTenantId = String(process.env.ONEDRIVE_TENANT_ID || 'common').trim();
  const envScope = String(process.env.ONEDRIVE_SCOPES || 'offline_access User.Read Files.ReadWrite.All').trim();

  const dbClientId = String(dbSettings?.client_id || '').trim();
  const dbTenantId = String(dbSettings?.tenant_id || '').trim();
  const dbScopes = String(dbSettings?.scopes || '').trim();
  const dbRedirectUri = String(dbSettings?.redirect_uri || '').trim();
  const dbPublicBase = String(dbSettings?.gateway_public_base_url || '').trim();

  let dbClientSecret = '';
  if (dbSettings?.client_secret_enc) {
    try {
      dbClientSecret = decryptSettingsSecret(dbSettings.client_secret_enc);
    } catch (_error) {
      dbClientSecret = '';
    }
  }

  let redirectUri = dbRedirectUri;
  if (!redirectUri) {
    if (dbPublicBase) {
      const basePath = String(process.env.NODE_ENV === 'development'
        ? process.env.BASE_PATH_DEV
        : process.env.BASE_PATH_PROD).trim();
      if (basePath) {
        redirectUri = `${dbPublicBase}${basePath}/internal/onedrive/callback`;
      }
    } else {
      redirectUri = buildRedirectUri();
    }
  }

  return {
    source: dbClientId ? 'db' : 'env',
    clientId: dbClientId || envClientId,
    clientSecret: dbClientSecret || envClientSecret,
    tenantId: dbTenantId || envTenantId,
    scope: dbScopes || envScope,
    redirectUri,
    gatewayPublicBaseUrl: dbPublicBase || String(process.env.GATEWAY_PUBLIC_BASE_URL || '').trim(),
    hasDbSettings: !!dbSettings,
    hasClientSecretInDb: !!dbClientSecret
  };
}

class OneDriveAuthService {
  async _getValidAccessToken(user) {
    const connection = await OneDriveDAO.getActiveConnectionByUser(user.id);

    if (!connection || connection.status !== 'connected') {
      return { ok: false, reason: 'not_connected' };
    }

    const actor = `gateway-onedrive:${user.userName || user.id}`;
    let effectiveConnection = connection;

    const refreshed = await this._refreshAccessTokenIfNeeded(connection, actor);
    if (refreshed) {
      effectiveConnection = refreshed;
    }

    const expiresAt = effectiveConnection.access_expires_at ? new Date(effectiveConnection.access_expires_at) : null;
    if (!expiresAt || expiresAt <= new Date()) {
      return { ok: false, reason: 'token_expired' };
    }

    if (!effectiveConnection.access_token_enc) {
      return { ok: false, reason: 'missing_access_token' };
    }

    let accessToken = '';
    try {
      accessToken = decryptSecret(effectiveConnection.access_token_enc);
    } catch (_error) {
      return { ok: false, reason: 'token_decrypt_failed' };
    }

    if (!accessToken) {
      return { ok: false, reason: 'missing_access_token' };
    }

    await OneDriveDAO.touchConnection(effectiveConnection.id, actor);

    return {
      ok: true,
      accessToken,
      expiresAt: expiresAt.toISOString()
    };
  }

  async smokeWrite(user, options = {}) {
    const token = await this._getValidAccessToken(user);
    if (!token.ok) {
      return { ok: false, reason: token.reason };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const moduleName = sanitizeModuleName(options.module);
    const dateParts = formatUtcDateParts(now);
    const fileName = `pdms-${moduleName}-${dateParts.stamp}.json`;
    const writePayload = {
      type: 'pdms-onedrive-smoke',
      module: moduleName,
      timestamp: nowIso,
      user: user.userName || user.id,
      data: options.payload && typeof options.payload === 'object' ? options.payload : {
        message: 'Teste de escrita PDMS OneDrive'
      }
    };

    const filePath = encodePathSegments(['pdms-smoke', moduleName, dateParts.year, dateParts.month, dateParts.day, fileName]);

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${filePath}:/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(writePayload, null, 2)
    });

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      payload = { raw };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: 'graph_write_failed',
        message: payload?.error?.message || 'Falha ao escrever ficheiro de teste no OneDrive.'
      };
    }

    return {
      ok: true,
      file: {
        id: payload.id || null,
        name: payload.name || fileName,
        path: `pdms-smoke/${moduleName}/${dateParts.year}/${dateParts.month}/${dateParts.day}/${fileName}`,
        size: payload.size || null,
        webUrl: payload.webUrl || null,
        lastModifiedDateTime: payload.lastModifiedDateTime || null
      },
      expiresAt: token.expiresAt
    };
  }

  async smokeRead(user, options = {}) {
    const token = await this._getValidAccessToken(user);
    if (!token.ok) {
      return { ok: false, reason: token.reason };
    }

    const moduleName = sanitizeModuleName(options.module);
    const top = Number(options.top) > 0 ? Math.min(Number(options.top), 50) : 20;
    const basePath = encodePathSegments(['pdms-smoke', moduleName]);

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${basePath}:/children?$top=${top}&$select=id,name,size,lastModifiedDateTime,file,folder,webUrl`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`
      }
    });

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      payload = { raw };
    }

    if (!response.ok) {
      if (response.status === 404 && payload?.error?.code === 'itemNotFound') {
        return {
          ok: true,
          module: moduleName,
          items: [],
          expiresAt: token.expiresAt
        };
      }

      return {
        ok: false,
        reason: 'graph_read_failed',
        message: payload?.error?.message || 'Falha ao ler ficheiros do OneDrive.'
      };
    }

    const items = Array.isArray(payload.value)
      ? payload.value.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.folder ? 'folder' : 'file',
        lastModifiedDateTime: item.lastModifiedDateTime || null,
        webUrl: item.webUrl || null
      }))
      : [];

    return {
      ok: true,
      module: moduleName,
      items,
      expiresAt: token.expiresAt
    };
  }

  async getSetup() {
    const resolved = await getResolvedConfig();
    return {
      source: resolved.source,
      hasSetup: Boolean(resolved.clientId && resolved.redirectUri),
      clientId: resolved.clientId || '',
      tenantId: resolved.tenantId || 'common',
      scopes: resolved.scope || 'offline_access User.Read Files.ReadWrite.All',
      redirectUri: resolved.redirectUri || '',
      gatewayPublicBaseUrl: resolved.gatewayPublicBaseUrl || '',
      hasClientSecret: Boolean(resolved.clientSecret)
    };
  }

  async saveSetup(payload, actor) {
    const current = await OneDriveSettingsDAO.getSettings();
    const clientId = String(payload?.clientId || '').trim();
    const clientSecret = String(payload?.clientSecret || '').trim();
    const tenantId = String(payload?.tenantId || 'common').trim();
    const scopes = String(payload?.scopes || 'offline_access User.Read Files.ReadWrite.All').trim();
    const redirectUri = String(payload?.redirectUri || '').trim();
    const gatewayPublicBaseUrl = String(payload?.gatewayPublicBaseUrl || '').trim();

    if (!clientId) {
      return { ok: false, reason: 'client_id_required' };
    }

    if (!clientSecret && !current?.client_secret_enc) {
      return { ok: false, reason: 'client_secret_required' };
    }

    if (!redirectUri && !gatewayPublicBaseUrl) {
      return { ok: false, reason: 'redirect_or_base_required' };
    }

    const clientSecretEnc = clientSecret
      ? encryptSettingsSecret(clientSecret)
      : String(current.client_secret_enc || '');

    await OneDriveSettingsDAO.upsertSettings({
      clientId,
      clientSecretEnc,
      tenantId,
      scopes,
      redirectUri,
      gatewayPublicBaseUrl
    }, actor);

    return { ok: true };
  }

  async getStatus(user) {
    const connection = await OneDriveDAO.getActiveConnectionByUser(user.id);

    if (!connection) {
      return {
        connected: false,
        status: 'not_connected'
      };
    }

    const actor = `gateway-onedrive:${user.userName || user.id}`;
    let effectiveConnection = connection;

    if (connection.status === 'connected') {
      const refreshed = await this._refreshAccessTokenIfNeeded(connection, actor);
      if (refreshed) {
        effectiveConnection = refreshed;
      }
    }

    await OneDriveDAO.touchConnection(effectiveConnection.id, actor);

    const expiresAt = effectiveConnection.access_expires_at ? new Date(effectiveConnection.access_expires_at) : null;
    const now = new Date();

    return {
      connected: effectiveConnection.status === 'connected' && !!expiresAt && expiresAt > now,
      status: effectiveConnection.status,
      accountEmail: effectiveConnection.account_email || null,
      tenantId: effectiveConnection.tenant_id || null,
      driveId: effectiveConnection.drive_id || null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      scope: effectiveConnection.scope || null
    };
  }

  async _refreshAccessTokenIfNeeded(connection, actor) {
    const expiresAt = connection.access_expires_at ? new Date(connection.access_expires_at) : null;
    if (!isTokenExpiringSoon(expiresAt)) {
      return null;
    }

    if (!connection.refresh_token_enc) {
      return null;
    }

    const resolved = await getResolvedConfig();
    const clientId = resolved.clientId;
    const clientSecret = resolved.clientSecret;
    const tenantId = resolved.tenantId;
    const scope = resolved.scope;

    if (!clientId || !clientSecret) {
      return null;
    }

    let refreshToken;
    try {
      refreshToken = decryptSecret(connection.refresh_token_enc);
    } catch (_error) {
      return null;
    }

    if (!refreshToken) {
      return null;
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const form = new URLSearchParams();
    form.set('client_id', clientId);
    form.set('client_secret', clientSecret);
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', refreshToken);
    form.set('scope', scope);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });

    const rawBody = await response.text();
    let body = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (_error) {
      body = { raw: rawBody };
    }

    if (!response.ok) {
      return null;
    }

    const expiresInSec = Number(body.expires_in || 3600);
    const accessExpiresAt = new Date(Date.now() + expiresInSec * 1000);
    const nextRefreshToken = String(body.refresh_token || refreshToken);

    await OneDriveDAO.saveTokens(connection.id, {
      accessTokenEnc: encryptSecret(String(body.access_token || '')),
      refreshTokenEnc: encryptSecret(nextRefreshToken),
      accessExpiresAt,
      scope: body.scope || scope || connection.scope || null,
      tokenType: body.token_type || connection.token_type || 'Bearer'
    }, actor);

    await OneDriveDAO.markConnected(connection.id, {
      tenantId: connection.tenant_id || tenantId,
      driveId: connection.drive_id || null,
      accountEmail: connection.account_email || null
    }, actor);

    return OneDriveDAO.getActiveConnectionByUser(connection.owner_user_id);
  }

  async startAuthorization(user) {
    const resolved = await getResolvedConfig();
    const clientId = resolved.clientId;
    const tenantId = resolved.tenantId;
    const redirectUri = resolved.redirectUri;
    const scope = resolved.scope;

    if (!clientId || !redirectUri) {
      return {
        ok: false,
        reason: 'setup_required',
        message: 'Setup OneDrive incompleto. Configure credenciais em Auth > OneDrive.'
      };
    }

    const stateToken = crypto.randomBytes(24).toString('hex');
    const codeVerifier = encodeBase64Url(crypto.randomBytes(64));
    const codeChallenge = encodeBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());
    const actor = `gateway-onedrive:${user.userName || user.id}`;

    const connectionId = await OneDriveDAO.createOrUpdatePendingConnection(user.id, actor);
    if (!connectionId) {
      throw new Error('Nao foi possivel preparar registo de ligacao OneDrive.');
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await OneDriveDAO.createAuthState(user.id, connectionId, stateToken, codeVerifier, expiresAt, actor);

    const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_mode', 'query');
    authorizeUrl.searchParams.set('scope', scope);
    authorizeUrl.searchParams.set('state', stateToken);
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    return {
      ok: true,
      authorizeUrl: authorizeUrl.toString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  async handleCallback(query) {
    const state = String(query.state || '').trim();
    const code = String(query.code || '').trim();
    const error = String(query.error || '').trim();

    if (error) {
      return { ok: false, reason: 'provider_error', message: error };
    }

    if (!state || !code) {
      return { ok: false, reason: 'missing_callback_params' };
    }

    const stateRow = await OneDriveDAO.getValidAuthState(state);
    if (!stateRow) {
      return { ok: false, reason: 'invalid_state' };
    }

    if (stateRow.used_at) {
      return { ok: false, reason: 'state_already_used' };
    }

    if (new Date(stateRow.expires_at) < new Date()) {
      return { ok: false, reason: 'state_expired' };
    }

    const resolved = await getResolvedConfig();
    const clientId = resolved.clientId;
    const clientSecret = resolved.clientSecret;
    const tenantId = resolved.tenantId;
    const redirectUri = resolved.redirectUri;
    const scope = resolved.scope;

    if (!clientId || !clientSecret || !redirectUri) {
      return { ok: false, reason: 'setup_required' };
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const form = new URLSearchParams();
      form.set('client_id', clientId);
      form.set('client_secret', clientSecret);
      form.set('grant_type', 'authorization_code');
      form.set('code', code);
      form.set('redirect_uri', redirectUri);
      form.set('scope', scope);
      form.set('code_verifier', stateRow.code_verifier);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });

      const rawBody = await response.text();
      let body = {};
      try {
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch (_error) {
        body = { raw: rawBody };
      }

      if (!response.ok) {
        return {
          ok: false,
          reason: 'token_exchange_failed',
          message: body?.error_description || body?.error || 'Erro ao trocar code por token'
        };
      }

      const expiresInSec = Number(body.expires_in || 3600);
      const accessExpiresAt = new Date(Date.now() + expiresInSec * 1000);

      await OneDriveDAO.saveTokens(stateRow.connection_id, {
        accessTokenEnc: encryptSecret(String(body.access_token || '')),
        refreshTokenEnc: encryptSecret(String(body.refresh_token || '')),
        accessExpiresAt,
        scope: body.scope || scope,
        tokenType: body.token_type || 'Bearer'
      }, 'gateway-onedrive-callback');

      await OneDriveDAO.markConnected(stateRow.connection_id, {
        tenantId,
        driveId: null,
        accountEmail: null
      }, 'gateway-onedrive-callback');

      await OneDriveDAO.markAuthStateUsed(stateRow.id, 'gateway-onedrive-callback');

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: 'callback_processing_failed',
        message: error.message
      };
    }
  }

  async disconnect(user) {
    const actor = `gateway-onedrive:${user.userName || user.id}`;
    const disconnected = await OneDriveDAO.markDisconnectedByUser(user.id, actor);
    return { disconnected };
  }
}

module.exports = new OneDriveAuthService();
