const express = require('express');

const authRoutes = require('./auth.routes');
const appsRoutes = require('./apps.routes');

const router = express.Router();

router.use(authRoutes); // inclui GET /validate-session
router.use('/apps', appsRoutes);

module.exports = router;
