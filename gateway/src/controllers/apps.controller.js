const { getApps } = require('../config/apps');

function listApps(req, res) {
  return res.render('apps/index', {
    pageTitle: 'Aplicações',
    user: req.session.user,
    apps: getApps(),
    userName: req.session.user?.userName || 'Utilizador',
    userEmail: req.session.user?.email || '',
    userRole: req.session.user?.role || ''
  });
}

module.exports = {
  listApps
};
