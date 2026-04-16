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

  return res.render('apps/index', {
    pageTitle: 'Aplicações',
    user: req.session.user,
    apps: getApps({ host, protocol, isProxied }),
    userName: req.session.user?.userName || 'Utilizador',
    userEmail: req.session.user?.email || '',
    userRole: req.session.user?.role || ''
  });
}

module.exports = {
  listApps
};
