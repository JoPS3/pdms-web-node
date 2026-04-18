const { getApps } = require('../config/apps');

function firstHeaderValue(headerValue) {
  return String(headerValue || '')
    .split(',')[0]
    .trim();
}

function listApps(req, res) {
  const forwardedHost = firstHeaderValue(req.get('x-forwarded-host'));
  const forwardedProto = firstHeaderValue(req.get('x-forwarded-proto'));
  const host = String(forwardedHost || req.hostname || '').trim();
  const protocol = String(forwardedProto || req.protocol || 'http').trim() || 'http';
  const isProxied = Boolean(forwardedHost || forwardedProto);

  const user = req.authUser || null;

  return res.render('apps/index', {
    pageTitle: 'Aplicações',
    user,
    apps: getApps({ host, protocol, isProxied }, { role: user?.role }),
    userName: user?.userName || 'Utilizador',
    userEmail: user?.email || '',
    userRole: user?.role || ''
  });
}

module.exports = {
  listApps
};
