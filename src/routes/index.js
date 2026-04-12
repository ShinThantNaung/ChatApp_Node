const express = require('express');
const router = express.Router();

const authRoutes = require('./auth/routes');
const socketRoutes = require('./socket/routes');

router.use('/auth', authRoutes);
router.use('/socket', socketRoutes);

module.exports = router;