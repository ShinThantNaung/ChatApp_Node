const express = require('express');
const { authenticate } = require('../auth/Middleware/auth.middleware');
const { joinPing, createPing, getActivePing, leavePing } = require('./ping.controller');
const router = express.Router();

router.post('/joinPing', authenticate, joinPing);
router.post('/createPing', authenticate, createPing);
router.get('/getActivePing', authenticate, getActivePing);
router.post('/leavePing', authenticate, leavePing);

module.exports = router;