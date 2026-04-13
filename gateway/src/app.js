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
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax'
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

// Error handlers
app.use((req, res) => {
  res.status(404).render('errors/404', {
    basePath
  });
});

module.exports = app;
