const express = require('express');

const authRoutes = require('./auth.routes');
const appsRoutes = require('./apps.routes');

const router = express.Router();

router.use(authRoutes);
router.use('/apps', appsRoutes);

module.exports = router;
