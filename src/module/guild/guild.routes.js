const express = require('express');
const { authenticate,authorize } = require('../auth/Middleware/auth.middleware')
const { createGuild, joinGuild, getActiveGuild, leaveGuild, deleteGuild} = require('./guild.controller');
const router = express.Router();

const auth = () =>{
    authenticate;
}
const authAdmin = () =>{
    authenticate;
    authorize('admin');
}
router.get('/getActivePing',auth,getActiveGuild);
router.post('/createGuild',auth,createGuild);
router.post('/joinGuild',auth,joinGuild);
router.post('/leaveGuild',auth,leaveGuild);
router.delete('/deleteGuild',authAdmin,deleteGuild);


module.exports = router;