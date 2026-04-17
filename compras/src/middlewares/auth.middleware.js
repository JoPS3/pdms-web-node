const { createRequireGatewayAuth } = require('../../../shared/gatewayAuth');

const requireGatewayAuth = createRequireGatewayAuth('compras');

module.exports = {
  requireGatewayAuth
};
