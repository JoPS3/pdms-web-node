const axios = require('axios');

/**
 * Middleware que valida sessão chamando o gateway
 * Adiciona req.user se válido, redireciona para gateway login se inválido
 */
async function requireGatewayAuth(req, res, next) {
  const gatewayBasePath = req.app.get('gatewayBasePath');

  try {
    const sessionToken = req.cookies.session_token;

    if (!sessionToken) {
      return res.redirect(`${gatewayBasePath}/login`);
    }

    const gatewayValidateUrl = req.app.get('gatewayValidateUrl');

    // validateStatus: () => true para não lançar erro em 401
    const response = await axios.get(gatewayValidateUrl, {
      headers: { Cookie: `session_token=${sessionToken}` },
      timeout: 5000,
      validateStatus: () => true
    });

    if (!response.data.valid) {
      res.clearCookie('session_token');
      return res.redirect(`${gatewayBasePath}/login`);
    }

    // Gateway devolve { valid, userId, userName, email, roleId, role } (sem nested user)
    req.user = {
      id: response.data.userId,
      userName: response.data.userName,
      email: response.data.email,
      roleId: response.data.roleId,
      role: response.data.role
    };

    return next();
  } catch (error) {
    console.error('[mapas] Erro ao validar sessão com gateway:', error.message);
    res.clearCookie('session_token');
    return res.redirect(`${gatewayBasePath}/login`);
  }
}

module.exports = {
  requireGatewayAuth
};
