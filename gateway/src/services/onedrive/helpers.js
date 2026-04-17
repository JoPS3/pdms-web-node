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

function parseJsonPayload(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return { raw };
  }
}

module.exports = {
  isTokenExpiringSoon,
  sanitizeModuleName,
  formatUtcDateParts,
  encodePathSegments,
  parseJsonPayload
};
