const { createRequireGatewayAuth } = require('./gatewayAuth.local');

const requireGatewayAuth = createRequireGatewayAuth('rh');

module.exports = {
  requireGatewayAuth
};
