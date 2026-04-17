require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { startModuleServer } = require('../../shared/startModuleServer');
const app = require('./app');

startModuleServer(app, 6004, 'Compras');
