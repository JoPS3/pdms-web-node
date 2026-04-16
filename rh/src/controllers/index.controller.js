function indexPage(req, res) {
  const isDev = process.env.NODE_ENV === 'development';
  const basePath = isDev ? process.env.BASE_PATH_DEV : process.env.BASE_PATH_PROD;
  const gatewayBasePath = isDev ? process.env.GATEWAY_BASE_PATH_DEV : process.env.GATEWAY_BASE_PATH_PROD;

  res.render('index', {
    pageTitle: 'RH',
    basePath,
    gatewayBasePath,
    userName: req.user?.userName || 'Utilizador',
    userRole: req.user?.role || '',
    assetVersion: String(Date.now())
  });
}

module.exports = {
  indexPage
};
