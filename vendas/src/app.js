const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { requireGatewayAuth } = require('./middlewares/auth.middleware');
const internalRoutes = require('./routes');

const app = express();
const isDev = process.env.NODE_ENV === 'development';
const basePath = isDev ? process.env.BASE_PATH_DEV : process.env.BASE_PATH_PROD;
const gatewayBasePath = isDev ? process.env.GATEWAY_BASE_PATH_DEV : process.env.GATEWAY_BASE_PATH_PROD;
const gatewayPort = Number(isDev ? process.env.GATEWAY_PORT_DEV : process.env.GATEWAY_PORT_PROD) || 6000;
const gatewayValidateUrl = isDev ? process.env.GATEWAY_VALIDATE_DEV : process.env.GATEWAY_VALIDATE_PROD;
const assetVersion = String(Date.now());

app.set('basePath', basePath);
app.set('gatewayBasePath', gatewayBasePath);
app.set('gatewayPort', gatewayPort);
app.set('gatewayValidateUrl', gatewayValidateUrl);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Static files
app.use(basePath, express.static(path.join(__dirname, 'public')));

// Fallback para acesso local sem proxy
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use(basePath, internalRoutes);
app.use('/', internalRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
