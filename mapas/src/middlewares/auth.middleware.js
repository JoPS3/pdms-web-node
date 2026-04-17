const {
  createRequireGatewayAuth,
  createRequireGatewaySessionApi
} = require('./gatewayAuth.local');

/**
 * Middleware que valida sessão chamando o gateway
 * Adiciona req.user se válido, redireciona para gateway login se inválido
 */
const requireGatewayAuth = createRequireGatewayAuth('mapas');

/**
 * Middleware para APIs internas entre serviços.
 * Aceita session_token por cookie ou Bearer token e devolve JSON em falha.
 */
const requireGatewaySessionApi = createRequireGatewaySessionApi('mapas');

module.exports = {
  requireGatewayAuth,
  requireGatewaySessionApi
};
