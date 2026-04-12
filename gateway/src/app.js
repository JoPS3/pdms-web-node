const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');

const indexRoutes = require('./routes/index.routes');
const { basePath } = require('./config/runtime');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
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

app.use((req, res) => {
  res.status(404).render('errors/404');
});

module.exports = app;
