const express = require('express');
const { authenticate } = require('../auth/middleware/auth.middleware');
const { joinPing, createPing, getActivePing, leavePing,deletePing } = require('./ping.controller');
const router = express.Router();

router.post('/joinPing', authenticate, joinPing);
router.post('/createPing', authenticate, createPing);
router.get('/getActivePing', authenticate, getActivePing);
router.post('/leavePing', authenticate, leavePing);
router.delete('/deletePing', authenticate, deletePing);
module.exports = router;