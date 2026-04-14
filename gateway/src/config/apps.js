function getApps() {
  const basePathDev = process.env.BASE_PATH_DEV || '';

  return [
    {
      id: 'mapas',
      name: 'Mapas',
      description: 'Gestão de diário de caixa e auditoria',
      icon: '📊',
      url: `${basePathDev}/mapas`
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
    },
    {
      id: 'autenticacao',
      name: 'Autenticação',
      description: 'Gestão de acesso e permissões',
      icon: '🔐',
      url: `${basePathDev}/auth`
    }
  ];
}

module.exports = {
  getApps
};
