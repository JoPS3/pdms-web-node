const { basePath } = require('../config/runtime');
const AuthService = require('../services/AuthService');

function parseSessionToken(req) {
  const authorization = String(req.headers.authorization || '').trim();
  if (!authorization) {
    return '';
  }

  const [scheme, token] = authorization.split(' ');
  if (String(scheme || '').toLowerCase() === 'bearer' && String(token || '').trim()) {
    return String(token).trim();
  }

  return '';
}

/**
 * Redireciona root baseado em autenticação
 * Se autenticado → /apps
 * Se não autenticado → /login
 */
function redirectRoot(req, res) {
  if (req.session.user) {
    return res.redirect(`${basePath}/apps`);
  }
  return res.redirect(`${basePath}/login`);
}

/**
 * Renderiza página de login
 * Redireciona se já autenticado
 */
function renderLogin(req, res) {
  if (req.session.user) {
    return res.redirect(`${basePath}/apps`);
  }

  return res.render('auth/login', {
    pageTitle: 'Login',
    errorMessage: null
  });
}

/**
 * Processa login POST - 1º passo
 * 1. Valida username
 * 2. Se username válido e sem password → redireciona para set-password
 * 3. Se username válido e com password → redireciona para ask-password
 * 
 * Phase 2: Suporta também respostas JSON para clientes AJAX
 */
async function login(req, res) {
  const { username } = req.body;
  const isJsonRequest = req.headers.accept?.includes('application/json') || 
                       (req.headers['content-type']?.includes('application/json') && 
                        req.method === 'POST');

  // Validação básica
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
    // Verifica se username existe e o status
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

    // Armazena em session temporário
    req.session.tempUser = {
      id: result.userId,
      userName: result.userName
    };

    // Para JSON, retornar redirecionamento
    if (isJsonRequest) {
      const nextPath = result.status === 'set_password' 
        ? `${basePath}/set-password` 
        : `${basePath}/ask-password`;
      
      // Save session before responding with JSON
      return req.session.save((err) => {
        if (err) {
          console.error('Erro ao salvar session tempUser:', err);
          return res.status(500).json({ status: 'error', error: 'Erro ao processar login.' });
        }
        return res.json({
          status: 'ok',
          redirect: nextPath
        });
      });
    }

    // Para HTML, redirecionar tradicional
    // Se não tem password, vai para set-password
    if (result.status === 'set_password') {
      return res.redirect(`${basePath}/set-password`);
    }

    // Se tem password, vai para ask-password
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

/**
 * Renderiza página de set-password
 * Usada quando user não tem password definida
 */
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

/**
 * Processa form set-password
 * 1. Valida nova password
 * 2. Faz hash e atualiza na BD
 * 3. Cria sessão
 * 4. Redireciona para /apps
 */
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
    req.session.sessionToken = result.sessionToken;
    delete req.session.tempUser;

    return req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar session após setPassword:', err);
        return res.status(500).json({ status: 'error', error: 'Erro ao processar autenticação.' });
      }
      return res.json({
        status: 'ok',
        accessToken: result.sessionToken,
        refreshToken: null,
        expiresIn: 1200,
        redirect: `${basePath}/apps`
      });
    });
  } catch (error) {
    console.error('Erro ao definir password:', error);
    return res.status(500).json({ status: 'error', error: 'Erro ao definir password. Tente novamente.' });
  }
}

/**
 * Renderiza página ask-password
 * Usada quando user já tem password definida
 */
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

/**
 * Processa form verify-password (2º passo)
 * 1. Valida password
 * 2. Cria sessão em BD
 * 3. Armazena em session e cookie
 * 4. Redireciona para /apps
 */
async function verifyPassword(req, res) {
  const { userId, password } = req.body;

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
    req.session.sessionToken = result.accessToken;
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

/**
 * Valida sessão ativa
 * Usado por outras apps para verificar se token ainda é válido
 * GET /validate-session
 */
async function validateSession(req, res) {
  const sessionToken = parseSessionToken(req);

  if (!sessionToken) {
    return res.status(401).json({ valid: false, reason: 'no_token' });
  }

  try {
    const result = await AuthService.validateSession(sessionToken);

    if (!result.valid) {
      return res.status(401).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    return res.status(500).json({ valid: false, reason: 'error' });
  }
}

/**
 * Faz logout
 * 1. Marca sessão como inválida em BD
 * 2. Limpa session
 * 3. Remove cookie
 * 4. Redireciona para /login
 */
async function logout(req, res) {
  const sessionToken = parseSessionToken(req) || String(req.session?.sessionToken || '').trim();

  try {
    // Marca sessão como inválida em BD
    if (sessionToken) {
      await AuthService.logout(sessionToken);
    }

    // Limpa session Express
    req.session.destroy(() => {
      res.redirect(`${basePath}/login`);
    });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    // Mesmo com erro, limpa tudo
    req.session.destroy(() => {
      res.redirect(`${basePath}/login`);
    });
  }
}

/**
 * Renderiza página de erro 401 (Unauthorized)
 * Usado quando acesso é negado
 */
function render401(req, res, reason = 'unauthorized') {
  return res.status(401).render('errors/401', {
    basePath,
    reason
  });
}

/**
 * Phase 2: Endpoint para renovação de tokens
 * POST /refresh-token
 * Body: { refreshToken }
 * Returns: { accessToken, refreshToken, expiresIn, tokenType } ou { error, code }
 */
async function refreshToken(req, res) {
  const { refreshToken } = req.body;

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
      return res.status(401).json({
        status: 'error',
        code: result.code || 'REFRESH_FAILED',
        message: result.error
      });
    }

    // Sucesso: retorna novos tokens
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
  redirectRoot,
  renderLogin,
  login,
  renderSetPassword,
  setPassword,
  renderAskPassword,
  verifyPassword,
  logout,
  validateSession,
  render401,
  refreshToken
};
