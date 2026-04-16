const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { requireGatewayAuth } = require('./middlewares/auth.middleware');
const internalRoutes = require('./routes');
const authController = require('./controllers/auth.controller');

const app = express();
const isDev = process.env.NODE_ENV === 'development';
const basePath = isDev ? process.env.BASE_PATH_DEV : process.env.BASE_PATH_PROD;
const gatewayBasePath = isDev ? process.env.GATEWAY_BASE_PATH_DEV : process.env.GATEWAY_BASE_PATH_PROD;
const gatewayValidateUrl = isDev ? process.env.GATEWAY_VALIDATE_DEV : process.env.GATEWAY_VALIDATE_PROD;
const gatewayOneDriveSetupUrl = isDev ? process.env.GATEWAY_ONEDRIVE_SETUP_DEV : process.env.GATEWAY_ONEDRIVE_SETUP_PROD;
const gatewayOneDriveStatusUrl = isDev ? process.env.GATEWAY_ONEDRIVE_STATUS_DEV : process.env.GATEWAY_ONEDRIVE_STATUS_PROD;
const gatewayOneDriveConnectUrl = isDev ? process.env.GATEWAY_ONEDRIVE_CONNECT_DEV : process.env.GATEWAY_ONEDRIVE_CONNECT_PROD;
const gatewayOneDriveDisconnectUrl = isDev ? process.env.GATEWAY_ONEDRIVE_DISCONNECT_DEV : process.env.GATEWAY_ONEDRIVE_DISCONNECT_PROD;
const mapasAuditLogUrl = isDev
  ? (process.env.MAPAS_AUDIT_LOG_URL_DEV
      || process.env.MAPAS_AUDIT_LOG_URL
    || 'http://localhost:6002/pdms-new/mapas/internal/auditoria/log')
  : (process.env.MAPAS_AUDIT_LOG_URL_PROD
      || process.env.MAPAS_AUDIT_LOG_URL
    || 'http://localhost:6002/pdms/mapas/internal/auditoria/log');
const assetVersion = String(Date.now());

// Armazena em app settings
app.set('basePath', basePath);
app.set('gatewayBasePath', gatewayBasePath);
app.set('gatewayValidateUrl', gatewayValidateUrl);
app.set('gatewayOneDriveSetupUrl', gatewayOneDriveSetupUrl);
app.set('gatewayOneDriveStatusUrl', gatewayOneDriveStatusUrl);
app.set('gatewayOneDriveConnectUrl', gatewayOneDriveConnectUrl);
app.set('gatewayOneDriveDisconnectUrl', gatewayOneDriveDisconnectUrl);
app.set('mapasAuditLogUrl', mapasAuditLogUrl);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Injeta basePath em res.locals para todas as views
app.use((req, res, next) => {
  res.locals.basePath = basePath;
  res.locals.gatewayBasePath = gatewayBasePath;
  res.locals.assetVersion = assetVersion;
  next();
});

// Estáticos servidos antes do middleware de auth
app.use(basePath, express.static(path.join(__dirname, 'public')));

// Rotas técnicas/públicas e integrações internas
app.use(basePath, internalRoutes);
app.use('/', internalRoutes);

// Middleware de autenticação para rotas protegidas
app.use(basePath, requireGatewayAuth);

// Rotas protegidas
app.get(basePath + '/', authController.getHomePage);
app.get(basePath + '/users/export', authController.exportUsersList);
app.get(basePath + '/users/:userId/edit', authController.getEditUserPage);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: 'Error', error: err.message });
});

module.exports = app;
