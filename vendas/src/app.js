const { createModuleApp } = require('../../shared/createModuleApp');
const internalRoutes = require('./routes');

module.exports = createModuleApp(__dirname, internalRoutes);
