async function refreshAccessTokenIfNeeded(ctx, connection, actor) {
  const expiresAt = connection.access_expires_at ? new Date(connection.access_expires_at) : null;
  if (!ctx.isTokenExpiringSoon(expiresAt)) {
    return null;
  }

  if (!connection.refresh_token_enc) {
    return null;
  }

  const resolved = await ctx.getResolvedConfig();
  const clientId = resolved.clientId;
  const clientSecret = resolved.clientSecret;
  const tenantId = resolved.tenantId;
  const scope = resolved.scope;

  if (!clientId || !clientSecret) {
    return null;
  }

  let refreshToken;
  try {
    refreshToken = ctx.decryptSecret(connection.refresh_token_enc);
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
  const body = ctx.parseJsonPayload(rawBody);

  if (!response.ok) {
    return null;
  }

  const expiresInSec = Number(body.expires_in || 3600);
  const accessExpiresAt = new Date(Date.now() + expiresInSec * 1000);
  const nextRefreshToken = String(body.refresh_token || refreshToken);

  await ctx.dao.saveTokens(connection.id, {
    accessTokenEnc: ctx.encryptSecret(String(body.access_token || '')),
    refreshTokenEnc: ctx.encryptSecret(nextRefreshToken),
    accessExpiresAt,
    scope: body.scope || scope || connection.scope || null,
    tokenType: body.token_type || connection.token_type || 'Bearer'
  }, actor);

  await ctx.dao.markConnected(connection.id, {
    tenantId: connection.tenant_id || tenantId,
    driveId: connection.drive_id || null,
    accountEmail: connection.account_email || null
  }, actor);

  return ctx.dao.getActiveConnectionByUser(connection.owner_user_id);
}

async function getValidAccessToken(ctx, user) {
  const connection = await ctx.dao.getActiveConnectionByUser(user.id);

  if (!connection || connection.status !== 'connected') {
    return { ok: false, reason: 'not_connected' };
  }

  const actor = `gateway-onedrive:${user.userName || user.id}`;
  let effectiveConnection = connection;

  const refreshed = await refreshAccessTokenIfNeeded(ctx, connection, actor);
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
    accessToken = ctx.decryptSecret(effectiveConnection.access_token_enc);
  } catch (_error) {
    return { ok: false, reason: 'token_decrypt_failed' };
  }

  if (!accessToken) {
    return { ok: false, reason: 'missing_access_token' };
  }

  await ctx.dao.touchConnection(effectiveConnection.id, actor);

  return {
    ok: true,
    accessToken,
    expiresAt: expiresAt.toISOString()
  };
}

async function getStatus(ctx, user) {
  const connection = await ctx.dao.getActiveConnectionByUser(user.id);

  if (!connection) {
    return {
      connected: false,
      status: 'not_connected'
    };
  }

  const actor = `gateway-onedrive:${user.userName || user.id}`;
  let effectiveConnection = connection;

  if (connection.status === 'connected') {
    const refreshed = await refreshAccessTokenIfNeeded(ctx, connection, actor);
    if (refreshed) {
      effectiveConnection = refreshed;
    }
  }

  await ctx.dao.touchConnection(effectiveConnection.id, actor);

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

module.exports = {
  getValidAccessToken,
  refreshAccessTokenIfNeeded,
  getStatus
};
