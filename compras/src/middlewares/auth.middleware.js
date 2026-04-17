const { createRequireGatewayAuth } = require('./gatewayAuth.local');

const requireGatewayAuth = createRequireGatewayAuth('compras');

module.exports = {
  requireGatewayAuth
};
