const path = require('path');
const mysql = require('mysql2/promise');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const indexRoutes = require('./routes/index.routes');
const { basePath } = require('./config/runtime');

const sessionPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pedaco-000',
  waitForConnections: true,
  connectionLimit: 5
});

const sessionStore = new MySQLStore({
  createDatabaseTable: true,
  schema: {
    tableName: 'express_sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, sessionPool);

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Trust the first proxy (nginx) so req.secure reflects the original HTTPS connection
app.set('trust proxy', 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto'  // true when request is HTTPS (requires trust proxy), false on HTTP
    }
  })
);

app.use((req, res, next) => {
  res.locals.basePath = basePath;
  next();
});

if (basePath) {
  app.get('/', (req, res) => {
    res.redirect(basePath);
  });
}

app.use(basePath || '/', express.static(path.join(__dirname, 'public')));
app.use(basePath || '/', indexRoutes);

function isConnectionRefused(error) {
  if (!error) {
    return false;
  }

  if (String(error.code || '').toUpperCase() === 'ECONNREFUSED') {
    return true;
  }

  const nestedErrors = Array.isArray(error.errors) ? error.errors : [];
  if (nestedErrors.some((item) => String(item?.code || '').toUpperCase() === 'ECONNREFUSED')) {
    return true;
  }

  return String(error.message || '').toUpperCase().includes('ECONNREFUSED');
}

app.use((error, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  const unavailable = isConnectionRefused(error);
  const statusCode = unavailable ? 503 : (Number(error.status || error.statusCode) || 500);
  const accept = String(req.headers?.accept || '').toLowerCase();
  const acceptsHtml = accept.includes('text/html');

  if (acceptsHtml) {
    if (unavailable) {
      return res.status(statusCode).render('errors/503', {
        basePath,
        appName: 'unknown',
        appLabel: 'serviço solicitado',
        unavailable: true
      });
    }

    return res.status(statusCode).render('errors/500', {
      basePath
    });
  }

  return res.status(statusCode).json({
    error: unavailable ? 'service_unavailable' : 'internal_error',
    message: unavailable
      ? 'O serviço solicitado está temporariamente indisponível.'
      : 'Erro interno no gateway.'
  });
});

// Error handlers
app.use((req, res) => {
  res.status(404).render('errors/404', {
    basePath
  });
});

module.exports = app;
