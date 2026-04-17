async function getSetup(ctx) {
  const resolved = await ctx.getResolvedConfig();
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

async function saveSetup(ctx, payload, actor) {
  const current = await ctx.settingsDAO.getSettings();
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
    ? ctx.encryptSettingsSecret(clientSecret)
    : String(current.client_secret_enc || '');

  await ctx.settingsDAO.upsertSettings({
    clientId,
    clientSecretEnc,
    tenantId,
    scopes,
    redirectUri,
    gatewayPublicBaseUrl
  }, actor);

  return { ok: true };
}

module.exports = {
  getSetup,
  saveSetup
};
