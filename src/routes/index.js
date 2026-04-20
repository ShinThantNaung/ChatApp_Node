const express = require('express');
const router = express.Router();

const authRoutes = require('../module/auth/routes/auth.routes');
const pingRoutes = require('../module/ping/ping.routes');
const guildRoutes = require('../module/guild/guild.routes')
const mlbbAcademyRoutes = require('../module/mlbbAcademy/mlbbAcademy.routes');

router.use('/auth', authRoutes);
router.use('/ping', pingRoutes);
router.use('/guild', guildRoutes);
router.use('/mlbbAcademy', mlbbAcademyRoutes);

module.exports = router;