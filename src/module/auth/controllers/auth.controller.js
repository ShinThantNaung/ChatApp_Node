const authService = require('../services/auth.services');

const getStatusCode = (message) => {
    switch (message) {
        case 'Email and password are required':
        case 'Email is required':
        case 'OTP is required':
        case 'OTP must be a 6-digit code':
        case 'Username, email, and password are required':
        case 'Name, email, and password are required':
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
        default:
            return 500;
    }
};

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.register(username, email, password);
        res.status(201).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};

const login = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.login(username, email, password);
        res.status(200).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};

const sendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.sendVerification(email);
        res.status(200).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};

const verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const result = await authService.verifyEmailOtp(email, otp);
        res.status(200).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};

module.exports = { register, login, sendVerification, verifyEmailOtp };