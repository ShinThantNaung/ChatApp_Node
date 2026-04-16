const express = require('express');
const { authenticate } = require('../auth/middleware/auth.middleware');
const { createGuild, joinGuild, getActiveGuild, leaveGuild, deleteGuild} = require('./guild.controller');
const router = express.Router();

router.get('/getActiveGuild', authenticate, getActiveGuild);
router.get('/getActivePing', authenticate, getActiveGuild);
router.post('/createGuild', authenticate, createGuild);
router.post('/joinGuild', authenticate, joinGuild);
router.post('/leaveGuild', authenticate, leaveGuild);
router.delete('/deleteGuild', authenticate, deleteGuild);


module.exports = router;