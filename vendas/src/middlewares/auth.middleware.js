const { createRequireGatewayAuth } = require('./gatewayAuth.local');

const requireGatewayAuth = createRequireGatewayAuth('vendas');

module.exports = {
  requireGatewayAuth
};
