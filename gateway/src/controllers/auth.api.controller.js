const { basePath } = require('../config/runtime');
const AuthService = require('../services/auth.service');
const {
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies
} = require('../utils/authTokens');

async function login(req, res) {
  const { username } = req.body;
  const isJsonRequest = req.headers.accept?.includes('application/json') ||
                       (req.headers['content-type']?.includes('application/json') &&
                        req.method === 'POST');

  if (!username) {
    const error = 'Introduza um utilizador para continuar.';
    if (isJsonRequest) {
      return res.status(400).json({ status: 'error', error });
    }
    return res.status(400).render('auth/login', {
      pageTitle: 'Login',
      errorMessage: error
    });
  }

  try {
    const result = await AuthService.checkUsername(username.trim());

    if (result.error) {
      if (isJsonRequest) {
        return res.status(401).json({ status: 'error', error: result.error });
      }
      return res.status(401).render('auth/login', {
        pageTitle: 'Login',
        errorMessage: result.error
      });
    }

    req.session.tempUser = {
      id: result.userId,
      userName: result.userName
    };

    if (isJsonRequest) {
      const nextPath = result.status === 'set_password'
        ? `${basePath}/set-password`
        : `${basePath}/ask-password`;

      return req.session.save((err) => {
        if (err) {
          console.error('Erro ao salvar session tempUser:', err);
          return res.status(500).json({ status: 'error', error: 'Erro ao processar login.' });
        }
        return res.json({ status: 'ok', redirect: nextPath });
      });
    }

    if (result.status === 'set_password') {
      return res.redirect(`${basePath}/set-password`);
    }

    return res.redirect(`${basePath}/ask-password`);
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    const errorMsg = 'Erro ao processar login. Tente novamente.';
    if (isJsonRequest) {
      return res.status(500).json({ status: 'error', error: errorMsg });
    }
    return res.status(500).render('auth/login', {
      pageTitle: 'Login',
      errorMessage: errorMsg
    });
  }
}

async function setPassword(req, res) {
  const { userId, password, passwordConfirm } = req.body;

  if (!req.session.tempUser) {
    return res.status(401).json({ status: 'error', error: 'Sessão expirada.', redirect: `${basePath}/login` });
  }

  if (!password || !passwordConfirm) {
    return res.status(400).json({ status: 'error', error: 'Introduza e confirme a password.' });
  }

  if (password !== passwordConfirm) {
    return res.status(400).json({ status: 'error', error: 'As passwords não coincidem.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ status: 'error', error: 'Password deve ter no mínimo 8 caracteres.' });
  }

  try {
    const result = await AuthService.setPassword(
      userId,
      password,
      req.ip,
      req.get('user-agent')
    );

    if (result.error) {
      return res.status(400).json({ status: 'error', error: result.error });
    }

    const user = req.session.tempUser;
    req.session.user = {
      id: result.userId || user.id,
      userName: result.userName || user.userName,
      email: result.email || '',
      roleId: result.roleId,
      role: result.role
    };
    setAuthCookies(req, res, result.sessionToken, result.refreshToken);
    delete req.session.tempUser;

    return req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar session após setPassword:', err);
        return res.status(500).json({ status: 'error', error: 'Erro ao processar autenticação.' });
      }
      return res.json({
        status: 'ok',
        accessToken: result.sessionToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn || 1200,
        redirect: `${basePath}/apps`
      });
    });
  } catch (error) {
    console.error('Erro ao definir password:', error);
    return res.status(500).json({ status: 'error', error: 'Erro ao definir password. Tente novamente.' });
  }
}

async function verifyPassword(req, res) {
  const { password } = req.body;

  if (!req.session.tempUser) {
    return res.status(401).json({ status: 'error', error: 'Sessão expirada.', redirect: `${basePath}/login` });
  }

  if (!password) {
    return res.status(400).json({ status: 'error', error: 'Introduza a password.' });
  }

  try {
    const result = await AuthService.loginWithTokens(
      req.session.tempUser.userName,
      password,
      req.ip,
      req.get('user-agent')
    );

    if (result.error) {
      return res.status(401).json({ status: 'error', error: result.error });
    }

    req.session.user = {
      id: result.user.id,
      userName: result.user.userName,
      email: result.user.email,
      roleId: result.user.roleId,
      role: result.user.role
    };
    setAuthCookies(req, res, result.accessToken, result.refreshToken);
    delete req.session.tempUser;

    return req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar session após verifyPassword:', err);
        return res.status(500).json({ status: 'error', error: 'Erro ao processar autenticação.' });
      }
      return res.json({
        status: 'ok',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        redirect: `${basePath}/apps`
      });
    });
  } catch (error) {
    console.error('Erro ao verificar password:', error);
    return res.status(500).json({ status: 'error', error: 'Erro ao processar autenticação. Tente novamente.' });
  }
}

async function validateSession(req, res) {
  const sessionToken = getAccessToken(req);
  const refreshToken = getRefreshToken(req);

  if (!sessionToken) {
    return res.status(401).json({ valid: false, reason: 'no_token' });
  }

  try {
    let result = await AuthService.validateSession(sessionToken);

    if (!result.valid && refreshToken) {
      const refreshResult = await AuthService.refreshTokens(
        refreshToken,
        req.ip,
        req.get('user-agent')
      );

      if (!refreshResult.error) {
        const refreshedValidation = await AuthService.validateSession(refreshResult.accessToken);
        if (refreshedValidation.valid) {
          setAuthCookies(req, res, refreshResult.accessToken, refreshResult.refreshToken);

          return res.json({
            ...refreshedValidation,
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken,
            expiresIn: refreshResult.expiresIn,
            tokenType: refreshResult.tokenType,
            refreshed: true
          });
        }
      }
    }

    if (!result.valid) {
      clearAuthCookies(req, res);
      return res.status(401).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    return res.status(500).json({ valid: false, reason: 'error' });
  }
}

async function refreshToken(req, res) {
  const bodyRefreshToken = String(req.body?.refreshToken || '').trim();
  const refreshToken = bodyRefreshToken || getRefreshToken(req);

  if (!refreshToken) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REFRESH_TOKEN',
      message: 'Refresh token é obrigatório'
    });
  }

  try {
    const result = await AuthService.refreshTokens(
      refreshToken,
      req.ip,
      req.get('user-agent')
    );

    if (result.error) {
      clearAuthCookies(req, res);
      return res.status(401).json({
        status: 'error',
        code: result.code || 'REFRESH_FAILED',
        message: result.error
      });
    }

    setAuthCookies(req, res, result.accessToken, result.refreshToken);

    return res.json({
      status: 'ok',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType
    });
  } catch (error) {
    console.error('Erro ao renovar tokens:', error);
    return res.status(500).json({
      status: 'error',
      code: 'REFRESH_ERROR',
      message: 'Erro ao processar renovação de tokens'
    });
  }
}

module.exports = {
  login,
  setPassword,
  verifyPassword,
  validateSession,
  refreshToken
};
