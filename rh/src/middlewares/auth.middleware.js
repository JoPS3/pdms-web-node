const { createRequireGatewayAuth } = require('../../../shared/gatewayAuth');

const requireGatewayAuth = createRequireGatewayAuth('rh');

module.exports = {
  requireGatewayAuth
};
