const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { requireGatewayAuth } = require('./middlewares/auth.middleware');

const app = express();
const isDev = process.env.NODE_ENV === 'development';
const basePath = isDev ? process.env.BASE_PATH_DEV : process.env.BASE_PATH_PROD;
const gatewayBasePath = isDev ? process.env.GATEWAY_BASE_PATH_DEV : process.env.GATEWAY_BASE_PATH_PROD;
const gatewayValidateUrl = isDev ? process.env.GATEWAY_VALIDATE_DEV : process.env.GATEWAY_VALIDATE_PROD;

// Armazena em app settings
app.set('basePath', basePath);
app.set('gatewayBasePath', gatewayBasePath);
app.set('gatewayValidateUrl', gatewayValidateUrl);

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
  next();
});

// Estáticos servidos antes do middleware de auth
app.use(basePath, express.static(path.join(__dirname, 'public')));

// Rota pública (sem auth)
app.get(basePath + '/health', (req, res) => {
  res.json({ status: 'ok', app: 'mapas' });
});

// Middleware de autenticação para rotas protegidas
app.use(basePath, requireGatewayAuth);

// Rotas protegidas
app.get(basePath + '/', (req, res) => {
  const modules = [
    {
      name: 'Diario de Caixa',
      description: 'Registo e consulta de movimentos de caixa',
      icon: '📒',
      url: `${basePath}/dashboard`
    },
    {
      name: 'Auditoria',
      description: 'Analise de logs e validacao operacional',
      icon: '🧾',
      url: '#'
    }
  ];

  res.render('index', {
    pageTitle: 'Mapas',
    userName: req.user?.userName || 'Utilizador',
    userRole: req.user?.role || '',
    modules
  });
});

app.get(basePath + '/dashboard', (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    user: req.user
  });
});

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
