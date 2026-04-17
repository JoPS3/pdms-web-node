const {
  parseSessionToken,
  validateGatewaySession,
  createRequireGatewayAuth,
  createRequireGatewaySessionApi
} = require('../../../shared/gatewayAuth');

/**
 * Middleware que valida sessão chamando o gateway
 * Adiciona req.user se válido, redireciona para gateway login se inválido
 */
const requireGatewayAuth = createRequireGatewayAuth('usuarios');

/**
 * Middleware para APIs internas entre serviços.
 * Aceita apenas Bearer token e devolve JSON em falha.
 */
const requireGatewaySessionApi = createRequireGatewaySessionApi('usuarios');

module.exports = {
  parseSessionToken,
  validateGatewaySession,
  requireGatewayAuth,
  requireGatewaySessionApi
};
