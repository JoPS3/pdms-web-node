function listApps(req, res) {
  // Apps disponíveis (será expandido depois com BD/config)
  const apps = [
    { 
      id: 'mapas',
      name: 'Mapas',
      description: 'Gestão de diário de caixa e auditoria',
      icon: '📊',
      url: '#' 
    },
    { 
      id: 'vendas',
      name: 'Vendas',
      description: 'Controlo de vendas e faturação',
      icon: '💰',
      url: '#' 
    },
    { 
      id: 'compras',
      name: 'Compras',
      description: 'Gestão de compras e fornecedores',
      icon: '📦',
      url: '#' 
    },
    { 
      id: 'rh',
      name: 'RH',
      description: 'Gestão de recursos humanos',
      icon: '👥',
      url: '#' 
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
