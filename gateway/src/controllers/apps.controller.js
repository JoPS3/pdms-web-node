function listApps(req, res) {
  // Apps disponíveis com URLs reais
  // Em prod, estas URLs podem vir de env vars ou DB
  const apps = [
    { 
      id: 'mapas',
      name: 'Mapas',
      description: 'Gestão de diário de caixa e auditoria',
      icon: '📊',
      url: `${process.env.BASE_PATH_DEV}/mapas` 
    },
    { 
      id: 'vendas',
      name: 'Vendas',
      description: 'Controlo de vendas e faturação',
      icon: '💰',
      url: '/vendas' 
    },
    { 
      id: 'compras',
      name: 'Compras',
      description: 'Gestão de compras e fornecedores',
      icon: '📦',
      url: '/compras' 
    },
    { 
      id: 'rh',
      name: 'RH',
      description: 'Gestão de recursos humanos',
      icon: '👥',
      url: '/rh' 
    }
  ];

  return res.render('apps/index', {
    pageTitle: 'Aplicações',
    user: req.session.user,
    apps,
    userName: req.session.user?.userName || 'Utilizador',
    userEmail: req.session.user?.email || '',
    userRole: req.session.user?.role || ''
  });
}

module.exports = {
  listApps
};
