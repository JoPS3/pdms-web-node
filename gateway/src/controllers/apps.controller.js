function listApps(req, res) {
  const apps = [
    { id: 'app-1', name: 'Aplicacao 1', url: '#' },
    { id: 'app-2', name: 'Aplicacao 2', url: '#' },
    { id: 'app-3', name: 'Aplicacao 3', url: '#' }
  ];

  return res.render('apps/index', {
    pageTitle: 'Aplicacoes',
    user: req.session.user,
    apps
  });
}

module.exports = {
  listApps
};
