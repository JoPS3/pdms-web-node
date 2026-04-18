const APP_ACCESS_BY_ROLE = {
  ADMINISTRADOR: '*',
  ADMIN: '*'
};

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function filterAppsByRole(apps, role) {
  const normalizedRole = normalizeRole(role);
  const allowed = APP_ACCESS_BY_ROLE[normalizedRole];

  if (allowed === '*') {
    return apps;
  }

  if (!Array.isArray(allowed) || allowed.length === 0) {
    return [];
  }

  const allowedSet = new Set(allowed);
  return apps.filter((app) => allowedSet.has(app.id));
}

function getApps(runtime = {}, options = {}) {
  const basePathDev = String(process.env.BASE_PATH_DEV || '').replace(/\/+$/, '');
  const withBasePath = (path) => `${basePathDev}${path}`;
  void runtime;

  const byEnvOrDefault = (envKey, fallbackPath) => {
    const raw = String(process.env[envKey] || '').trim();
    return raw || withBasePath(fallbackPath);
  };

  const sysadminUrl = String(process.env.APP_SYSADMIN_URL_DEV || '').trim()
    || withBasePath('/apps/sysadmin');
  const mapasUrl = byEnvOrDefault('APP_MAPAS_URL_DEV', '/apps/mapas');

  const apps = [
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
      id: 'sysadmin',
      name: 'Utilizadores',
      description: 'Gestão de utilizadores e acesso OneDrive',
      icon: '🔐',
      url: sysadminUrl
    }
  ];

  return filterAppsByRole(apps, options.role);
}

module.exports = {
  getApps,
  filterAppsByRole
};
