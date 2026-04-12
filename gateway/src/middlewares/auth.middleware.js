const { basePath } = require('../config/runtime');

function requireAuth(req, res, next) {
  if (!req.session.isAuthenticated) {
    return res.redirect(`${basePath}/login`);
  }

  return next();
}

module.exports = requireAuth;
