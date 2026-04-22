const authService = require('../services/auth.services');
const { logAuditEvent } = require('../../../utils/audit.logger');

const getStatusCode = (message) => {
    switch (message) {
        case 'Email and password are required':
        case 'Email is required':
        case 'OTP is required':
        case 'OTP must be a 6-digit code':
        case 'Username, email, and password are required':
        case 'Name, email, and password are required':
        case 'Username must be at least 6 characters':
        case 'Password must be at least 6 characters':
            return 422;
        case 'User already exists':
            return 409;
        case 'Email is already verified':
            return 409;
        case 'User does not exist':
            return 404;
        case 'Verification code not found':
            return 404;
        case 'Invalid credentials':
            return 401;
        case 'Invalid verification code':
            return 401;
        case 'Verification code expired':
            return 410;
        case 'Too many requests, please try again later':
        case 'Please wait before requesting a new verification code':
        case 'Too many failed attempts. Try again later':
            return 429;
        default:
            return 500;
    }
};

const sendError = (res, err, action) => {
    const statusCode = getStatusCode(err.message);

    if (statusCode === 500) {
        logAuditEvent('auth.http.error', {
            action,
            reason: 'internal_error',
        });
        return res.status(500).json({ message: 'Internal server error' });
    }

    if (statusCode === 401 || statusCode === 404 || statusCode === 410 || statusCode === 429) {
        logAuditEvent('auth.http.failure', {
            action,
            reason: err.message,
        });
    }

    return res.status(statusCode).json({ message: err.message });
};

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.register(username, email, password);
        res.status(201).json(result);
    } catch (err) {
        sendError(res, err, 'register');
    }
};

const login = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.login(username, email, password);
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err, 'login');
    }
};

const sendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.sendVerification(email);
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err, 'send_verification');
    }
};

const verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const result = await authService.verifyEmailOtp(email, otp);
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err, 'verify_email_otp');
    }
};

module.exports = { register, login, sendVerification, verifyEmailOtp };