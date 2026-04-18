const OneDriveSettingsDAO = require('../../daos/onedrive-settings.dao');
const { decryptSettingsSecret } = require('./crypto.helpers');

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

module.exports = {
  getResolvedConfig
};
