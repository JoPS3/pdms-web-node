const crypto = require('crypto');

function encodeBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
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

module.exports = {
  encodeBase64Url,
  encryptSecret,
  decryptSecret,
  encryptSettingsSecret,
  decryptSettingsSecret
};
