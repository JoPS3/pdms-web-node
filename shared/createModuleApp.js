const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

function createModuleApp(moduleDir, routes) {
  const app = express();
  const isDev = process.env.NODE_ENV === 'development';
  const basePath = isDev ? process.env.BASE_PATH_DEV : process.env.BASE_PATH_PROD;
  const gatewayBasePath = isDev ? process.env.GATEWAY_BASE_PATH_DEV : process.env.GATEWAY_BASE_PATH_PROD;
  const gatewayPort = Number(isDev ? process.env.GATEWAY_PORT_DEV : process.env.GATEWAY_PORT_PROD) || 6000;
  const gatewayValidateUrl = isDev ? process.env.GATEWAY_VALIDATE_DEV : process.env.GATEWAY_VALIDATE_PROD;

  app.set('basePath', basePath);
  app.set('gatewayBasePath', gatewayBasePath);
  app.set('gatewayPort', gatewayPort);
  app.set('gatewayValidateUrl', gatewayValidateUrl);

  app.set('view engine', 'ejs');
  app.set('views', path.join(moduleDir, 'views'));

  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use(basePath, express.static(path.join(moduleDir, 'public')));
  app.use(express.static(path.join(moduleDir, 'public')));

  app.use(basePath, routes);
  app.use('/', routes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

module.exports = {
  createModuleApp
};
