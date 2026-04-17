function getApps(runtime = {}) {
  const basePathDev = String(process.env.BASE_PATH_DEV || '').replace(/\/+$/, '');
  const withBasePath = (path) => `${basePathDev}${path}`;
  const host = String(runtime.host || '').trim();
  const protocol = String(runtime.protocol || 'http').trim() || 'http';
  const isProxied = Boolean(runtime.isProxied);
  const usuariosPort = Number(
    process.env.USUARIOS_PORT
    || process.env.USUARIOS_PORT_DEV
    || process.env.AUTH_PORT
    || process.env.AUTH_PORT_DEV
    || 6001
  );
  const mapasPort = Number(process.env.MAPAS_PORT || process.env.MAPAS_PORT_DEV || 6002);

  const withHostPort = (path, port) => {
    if (!host || !port) {
      return path;
    }
    return `${protocol}://${host}:${port}${path}`;
  };

  const byEnvOrDefault = (envKey, fallbackPath) => {
    const raw = String(process.env[envKey] || '').trim();
    return raw || withBasePath(fallbackPath);
  };

  const usuariosUrl = String(process.env.APP_USUARIOS_URL_DEV || process.env.APP_AUTH_URL_DEV || '').trim()
    || withBasePath('/usuarios');
  const mapasUrl = byEnvOrDefault('APP_MAPAS_URL_DEV', '/mapas');

  const resolveServiceUrl = (url, port) => {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    // Behind nginx/reverse proxy, keep path-only URLs on the same public origin.
    if (isProxied) {
      return url;
    }

    return withHostPort(url, port);
  };

  const resolvedUsuariosUrl = resolveServiceUrl(usuariosUrl, usuariosPort);
  const resolvedMapasUrl = resolveServiceUrl(mapasUrl, mapasPort);

  return [
    {
      id: 'mapas',
      name: 'Mapas',
      description: 'Gestão de diário de caixa e auditoria',
      icon: '📊',
      url: resolvedMapasUrl
    },
    {
      id: 'vendas',
      name: 'Vendas',
      description: 'Controlo de vendas e faturação',
      icon: '💰',
      url: byEnvOrDefault('APP_VENDAS_URL_DEV', '/vendas')
    },
    {
      id: 'compras',
      name: 'Compras',
      description: 'Gestão de compras e fornecedores',
      icon: '📦',
      url: byEnvOrDefault('APP_COMPRAS_URL_DEV', '/compras')
    },
    {
      id: 'rh',
      name: 'RH',
      description: 'Gestão de recursos humanos',
      icon: '👥',
      url: byEnvOrDefault('APP_RH_URL_DEV', '/rh')
    },
    {
      id: 'usuarios',
      name: 'Utilizadores',
      description: 'Gestão de utilizadores e acesso OneDrive',
      icon: '🔐',
      url: resolvedUsuariosUrl
    }
  ];
}

module.exports = {
  getApps
};
