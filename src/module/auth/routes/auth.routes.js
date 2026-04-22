const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
	register,
	login,
	sendVerification,
	verifyEmailOtp,
} = require('../controllers/auth.controller');
const { validateBody } = require('../middleware/validate.middleware');
const {
	registerSchema,
	loginSchema,
	sendVerificationSchema,
	verifyEmailOtpSchema,
} = require('../validators/auth.schema');

const getAuthIdentifier = (req) => {
	const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
	const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
	return email || username || 'anonymous';
};

const authAttemptLimiter = (windowMs, max) => rateLimit({
	windowMs,
	max,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => `${req.ip}:${getAuthIdentifier(req)}`,
	message: { message: 'Too many requests, please try again later' },
});

const loginLimiter = authAttemptLimiter(15 * 60 * 1000, 10);
const sendVerificationLimiter = authAttemptLimiter(10 * 60 * 1000, 5);
const verifyOtpLimiter = authAttemptLimiter(10 * 60 * 1000, 10);

const registerLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	max: 8,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many requests, please try again later' },
});

router.post('/register', registerLimiter, validateBody(registerSchema), register);
router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.post('/sendVerification', sendVerificationLimiter, validateBody(sendVerificationSchema), sendVerification);
router.post('/verifyEmailOtp', verifyOtpLimiter, validateBody(verifyEmailOtpSchema), verifyEmailOtp);

module.exports = router;