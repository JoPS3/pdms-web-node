const { createRequireGatewayAuth } = require('../../../shared/gatewayAuth');

const requireGatewayAuth = createRequireGatewayAuth('vendas');

module.exports = {
  requireGatewayAuth
};
