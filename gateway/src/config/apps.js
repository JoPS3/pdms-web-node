function getApps(runtime = {}) {
  const basePathDev = String(process.env.BASE_PATH_DEV || '').replace(/\/+$/, '');
  const withBasePath = (path) => `${basePathDev}${path}`;
  void runtime;

  const byEnvOrDefault = (envKey, fallbackPath) => {
    const raw = String(process.env[envKey] || '').trim();
    return raw || withBasePath(fallbackPath);
  };

  const usuariosUrl = String(process.env.APP_USUARIOS_URL_DEV || '').trim()
    || withBasePath('/apps/usuarios');
  const mapasUrl = byEnvOrDefault('APP_MAPAS_URL_DEV', '/apps/mapas');

  return [
    {
      id: 'mapas',
      name: 'Mapas',
      description: 'Gestão de diário de caixa e auditoria',
      icon: '📊',
      url: mapasUrl
    },
    {
      id: 'vendas',
      name: 'Vendas',
      description: 'Controlo de vendas e faturação',
      icon: '💰',
      url: byEnvOrDefault('APP_VENDAS_URL_DEV', '/apps/vendas')
    },
    {
      id: 'compras',
      name: 'Compras',
      description: 'Gestão de compras e fornecedores',
      icon: '📦',
      url: byEnvOrDefault('APP_COMPRAS_URL_DEV', '/apps/compras')
    },
    {
      id: 'rh',
      name: 'RH',
      description: 'Gestão de recursos humanos',
      icon: '👥',
      url: byEnvOrDefault('APP_RH_URL_DEV', '/apps/rh')
    },
    {
      id: 'usuarios',
      name: 'Utilizadores',
      description: 'Gestão de utilizadores e acesso OneDrive',
      icon: '🔐',
      url: usuariosUrl
    }
  ];
}

module.exports = {
  getApps
};
