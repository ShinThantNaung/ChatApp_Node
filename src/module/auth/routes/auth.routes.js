const express = require('express');
const router = express.Router();
const {
	register,
	login,
	sendVerification,
	verifyEmailOtp,
} = require('../controllers/auth.controller');
//const validate = require('../middlewares/auth.middleware').validate;
//const { registerSchema } = require('../validators/auth.schema');

router.post('/register', /*validate(registerSchema),*/ register);
router.post('/login', login);
router.post('/sendVerification', sendVerification);
router.post('/verifyEmailOtp', verifyEmailOtp);

module.exports = router;