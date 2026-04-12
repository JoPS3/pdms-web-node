const { basePath } = require('../config/runtime');

function redirectRoot(req, res) {
  if (req.session.isAuthenticated) {
    return res.redirect(`${basePath}/apps`);
  }

  return res.redirect(`${basePath}/login`);
}

function renderLogin(req, res) {
  if (req.session.isAuthenticated) {
    return res.redirect(`${basePath}/apps`);
  }

  return res.render('auth/login', {
    pageTitle: 'Login',
    errorMessage: null
  });
}

function login(req, res) {
  const username = String(req.body.username || '').trim();

  if (!username) {
    return res.status(400).render('auth/login', {
      pageTitle: 'Login',
      errorMessage: 'Introduza um utilizador para continuar.'
    });
  }

  req.session.isAuthenticated = true;
  req.session.user = {
    username
  };

  return res.redirect(`${basePath}/apps`);
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect(`${basePath}/login`);
  });
}

module.exports = {
  redirectRoot,
  renderLogin,
  login,
  logout
};
