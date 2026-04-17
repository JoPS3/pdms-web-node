const { basePath } = require('../config/runtime');

const ACCESS_COOKIE = 'pdms_access_token';
const REFRESH_COOKIE = 'pdms_refresh_token';

function parseBearerToken(req) {
  const authorization = String(req.headers?.authorization || '').trim();
  if (!authorization) {
    return '';
  }

  const [scheme, token] = authorization.split(' ');
  if (String(scheme || '').toLowerCase() === 'bearer' && String(token || '').trim()) {
    return String(token).trim();
  }

  return '';
}

function parseRefreshHeader(req) {
  return String(req.headers?.['x-refresh-token'] || '').trim();
}

function getAccessToken(req) {
  const bearer = parseBearerToken(req);
  if (bearer) {
    return bearer;
  }
  return String(req.cookies?.[ACCESS_COOKIE] || '').trim();
}

function getRefreshToken(req) {
  const fromHeader = parseRefreshHeader(req);
  if (fromHeader) {
    return fromHeader;
  }
  return String(req.cookies?.[REFRESH_COOKIE] || '').trim();
}

function buildCookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!req.secure,
    path: basePath || '/'
  };
}

function setAuthCookies(req, res, accessToken, refreshToken) {
  const options = buildCookieOptions(req);
  if (accessToken) {
    res.cookie(ACCESS_COOKIE, accessToken, options);
  }
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, options);
  }
}

function clearAuthCookies(req, res) {
  const options = buildCookieOptions(req);
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
}

module.exports = {
  parseBearerToken,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies
};
