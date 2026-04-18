const { basePath } = require('../config/runtime');
const AuthService = require('../services/auth.service');
const {
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies
} = require('../utils/authTokens');

function parseSessionToken(req) {
  const authorization = String(req.headers?.authorization || '').trim();
  if (!authorization) {
    return '';
  }

  const [scheme, token] = authorization.split(' ');
  if (String(scheme || '').toLowerCase() === 'bearer' && String(token || '').trim()) {
    return String(token).trim();
  }

  return '';
}

async function redirectRoot(req, res) {
  try {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.redirect(`${basePath}/login`);
    }

    const result = await AuthService.validateSession(accessToken);
    if (result.valid) {
      return res.redirect(`${basePath}/apps`);
    }

    const refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      clearAuthCookies(req, res);
      return res.redirect(`${basePath}/login`);
    }

    const refreshResult = await AuthService.refreshTokens(refreshToken, req.ip, req.get('user-agent'));
    if (refreshResult.error) {
      clearAuthCookies(req, res);
      return res.redirect(`${basePath}/login`);
    }

    setAuthCookies(req, res, refreshResult.accessToken, refreshResult.refreshToken);
    return res.redirect(`${basePath}/apps`);
  } catch (_error) {
    clearAuthCookies(req, res);
    return res.redirect(`${basePath}/login`);
  }
}

async function renderLogin(req, res) {
  try {
    const accessToken = getAccessToken(req);
    if (accessToken) {
      return res.redirect(`${basePath}/apps`);
    }
  } catch (_error) {
    clearAuthCookies(req, res);
  }

  return res.render('auth/login', {
    pageTitle: 'Login',
    errorMessage: null
  });
}

function renderSetPassword(req, res) {
  if (!req.session.tempUser) {
    return res.redirect(`${basePath}/login`);
  }

  return res.render('auth/set-password', {
    pageTitle: 'Definir Password',
    userId: req.session.tempUser.id,
    userName: req.session.tempUser.userName,
    errorMessage: null
  });
}

function renderAskPassword(req, res) {
  if (!req.session.tempUser) {
    return res.redirect(`${basePath}/login`);
  }

  return res.render('auth/ask-password', {
    pageTitle: 'Entrar',
    userId: req.session.tempUser.id,
    userName: req.session.tempUser.userName,
    errorMessage: null
  });
}

async function logout(req, res) {
  const sessionToken = parseSessionToken(req) || getAccessToken(req);

  try {
    if (sessionToken) {
      await AuthService.logout(sessionToken);
    }

    clearAuthCookies(req, res);
    req.session.destroy(() => {
      res.redirect(`${basePath}/login`);
    });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    clearAuthCookies(req, res);
    req.session.destroy(() => {
      res.redirect(`${basePath}/login`);
    });
  }
}

function render401(req, res, reason = 'unauthorized') {
  return res.status(401).render('errors/401', {
    basePath,
    reason
  });
}

module.exports = {
  redirectRoot,
  renderLogin,
  renderSetPassword,
  renderAskPassword,
  logout,
  render401
};
