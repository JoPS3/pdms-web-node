const { basePath } = require('../config/runtime');
const AuthService = require('../services/AuthService');

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
 */
async function login(req, res) {
  const { username } = req.body;

  // Validação básica
  if (!username) {
    return res.status(400).render('auth/login', {
      pageTitle: 'Login',
      errorMessage: 'Introduza um utilizador para continuar.'
    });
  }

  try {
    // Verifica se username existe e o status
    const result = await AuthService.checkUsername(username.trim());

    if (result.error) {
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

    // Se não tem password, vai para set-password
    if (result.status === 'set_password') {
      return res.redirect(`${basePath}/set-password`);
    }

    // Se tem password, vai para ask-password
    return res.redirect(`${basePath}/ask-password`);
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return res.status(500).render('auth/login', {
      pageTitle: 'Login',
      errorMessage: 'Erro ao processar login. Tente novamente.'
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
    return res.redirect(`${basePath}/login`);
  }

  // Validações
  if (!password || !passwordConfirm) {
    return res.status(400).render('auth/set-password', {
      pageTitle: 'Definir Password',
      userId,
      userName: req.session.tempUser.userName,
      errorMessage: 'Introduza e confirme a password.'
    });
  }

  if (password !== passwordConfirm) {
    return res.status(400).render('auth/set-password', {
      pageTitle: 'Definir Password',
      userId,
      userName: req.session.tempUser.userName,
      errorMessage: 'As passwords não coincidem.'
    });
  }

  if (password.length < 8) {
    return res.status(400).render('auth/set-password', {
      pageTitle: 'Definir Password',
      userId,
      userName: req.session.tempUser.userName,
      errorMessage: 'Password deve ter no mínimo 8 caracteres.'
    });
  }

  try {
    // Define password
    const result = await AuthService.setPassword(
      userId,
      password,
      req.ip,
      req.get('user-agent')
    );

    if (result.error) {
      return res.status(400).render('auth/set-password', {
        pageTitle: 'Definir Password',
        userId,
        userName: req.session.tempUser.userName,
        errorMessage: result.error
      });
    }

    // Sucesso: armazena dados em sessão
    const user = req.session.tempUser;
    req.session.user = {
      id: result.userId || user.id,
      userName: result.userName || user.userName,
      email: result.email || '',
      roleId: result.roleId,
      role: result.role
    };

    delete req.session.tempUser;

    // Define cookie
    res.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.redirect(`${basePath}/apps`);
  } catch (error) {
    console.error('Erro ao definir password:', error);
    return res.status(500).render('auth/set-password', {
      pageTitle: 'Definir Password',
      userId,
      userName: req.session.tempUser.userName,
      errorMessage: 'Erro ao definir password. Tente novamente.'
    });
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
    return res.redirect(`${basePath}/login`);
  }

  if (!password) {
    return res.status(400).render('auth/ask-password', {
      pageTitle: 'Entrar',
      userId,
      userName: req.session.tempUser.userName,
      errorMessage: 'Introduza a password.'
    });
  }

  try {
    // Valida password (precisa de user name para buscar na BD)
    const result = await AuthService.loginWithPassword(
      req.session.tempUser.userName,
      password,
      req.ip,
      req.get('user-agent')
    );

    if (result.error) {
      return res.status(401).render('auth/ask-password', {
        pageTitle: 'Entrar',
        userId,
        userName: req.session.tempUser.userName,
        errorMessage: result.error
      });
    }

    // Sucesso: armazena dados em sessão
    req.session.user = {
      id: result.userId,
      userName: result.userName,
      email: result.email,
      roleId: result.roleId,
      role: result.role
    };

    delete req.session.tempUser;

    // Define cookie
    res.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.redirect(`${basePath}/apps`);
  } catch (error) {
    console.error('Erro ao verificar password:', error);
    return res.status(500).render('auth/ask-password', {
      pageTitle: 'Entrar',
      userId,
      userName: req.session.tempUser.userName,
      errorMessage: 'Erro ao processar autenticação. Tente novamente.'
    });
  }
}

/**
 * Valida sessão ativa
 * Usado por outras apps para verificar se token ainda é válido
 * GET /validate-session
 */
async function validateSession(req, res) {
  const sessionToken = req.cookies.session_token;

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
  const sessionToken = req.cookies.session_token;

  try {
    // Marca sessão como inválida em BD
    if (sessionToken) {
      await AuthService.logout(sessionToken);
    }

    // Limpa session Express
    req.session.destroy(() => {
      // Remove cookie
      res.clearCookie('session_token');
      res.redirect(`${basePath}/login`);
    });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    // Mesmo com erro, limpa tudo
    req.session.destroy(() => {
      res.clearCookie('session_token');
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
  render401
};
