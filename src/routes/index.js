const express = require('express');
const router = express.Router();

const authRoutes = require('../module/auth/routes/auth.routes');
const pingRoutes = require('../module/ping/ping.routes');
const guildRoutes = require('../module/guild/guild.routes;')

router.use('/auth', authRoutes);
router.use('/ping', pingRoutes);
router.use('/guild',guildRoutes);

module.exports = router;