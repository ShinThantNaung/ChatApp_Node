const express = require('express');
const router = express.Router();

const authRoutes = require('./module/auth/routes');
const socketRoutes = require('./socket/routes');
const pingRoutes = require('./module/ping/routes')

router.use('/auth', authRoutes);
router.use('/ping',pingRoutes);
router.use('/socket', socketRoutes);

module.exports = router;