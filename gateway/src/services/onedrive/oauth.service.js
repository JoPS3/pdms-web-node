const crypto = require('crypto');

async function startAuthorization(ctx, user) {
  const resolved = await ctx.getResolvedConfig();
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
  const codeVerifier = ctx.encodeBase64Url(crypto.randomBytes(64));
  const codeChallenge = ctx.encodeBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  const actor = `gateway-onedrive:${user.userName || user.id}`;

  const existingConnection = await ctx.dao.getActiveConnectionByUser(user.id);
  let connectionId;
  if (existingConnection) {
    await ctx.dao.updateConnectionStatus(existingConnection.id, 'pending', actor);
    connectionId = existingConnection.id;
  } else {
    connectionId = await ctx.dao.createConnection(user.id, actor);
  }

  if (!connectionId) {
    throw new Error('Nao foi possivel preparar registo de ligacao OneDrive.');
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  await ctx.dao.createAuthState(user.id, connectionId, stateToken, codeVerifier, expiresAt, actor);

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

async function handleCallback(ctx, query) {
  const state = String(query.state || '').trim();
  const code = String(query.code || '').trim();
  const error = String(query.error || '').trim();

  if (error) {
    return { ok: false, reason: 'provider_error', message: error };
  }

  if (!state || !code) {
    return { ok: false, reason: 'missing_callback_params' };
  }

  const stateRow = await ctx.dao.getValidAuthState(state);
  if (!stateRow) {
    return { ok: false, reason: 'invalid_state' };
  }

  if (stateRow.used_at) {
    return { ok: false, reason: 'state_already_used' };
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    return { ok: false, reason: 'state_expired' };
  }

  const resolved = await ctx.getResolvedConfig();
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
    const body = ctx.parseJsonPayload(rawBody);

    if (!response.ok) {
      return {
        ok: false,
        reason: 'token_exchange_failed',
        message: body?.error_description || body?.error || 'Erro ao trocar code por token'
      };
    }

    const expiresInSec = Number(body.expires_in || 3600);
    const accessExpiresAt = new Date(Date.now() + expiresInSec * 1000);

    await ctx.dao.saveTokens(stateRow.connection_id, {
      accessTokenEnc: ctx.encryptSecret(String(body.access_token || '')),
      refreshTokenEnc: ctx.encryptSecret(String(body.refresh_token || '')),
      accessExpiresAt,
      scope: body.scope || scope,
      tokenType: body.token_type || 'Bearer'
    }, 'gateway-onedrive-callback');

    await ctx.dao.markConnected(stateRow.connection_id, {
      tenantId,
      driveId: null,
      accountEmail: null
    }, 'gateway-onedrive-callback');

    await ctx.dao.markAuthStateUsed(stateRow.id, 'gateway-onedrive-callback');

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: 'callback_processing_failed',
      message: error.message
    };
  }
}

async function disconnect(ctx, user) {
  const actor = `gateway-onedrive:${user.userName || user.id}`;
  const disconnected = await ctx.dao.markDisconnectedByUser(user.id, actor);
  return { disconnected };
}

module.exports = {
  startAuthorization,
  handleCallback,
  disconnect
};
