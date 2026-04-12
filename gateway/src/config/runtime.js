function normalizeBasePath(value) {
  if (!value) {
    return '';
  }

  const trimmed = String(value).trim();

  if (!trimmed || trimmed === '/') {
    return '';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

const basePath = normalizeBasePath(process.env.BASE_PATH_DEV || '');

module.exports = {
  basePath
};
