const authService = require('../services/auth.services');

const getStatusCode = (message) => {
    switch (message) {
        case 'Email and password are required':
        case 'Username, email, and password are required':
        case 'Name, email, and password are required':
            return 422;
        case 'User already exists':
            return 409;
        case 'User does not exist':
            return 404;
        case 'Invalid credentials':
            return 401;
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

module.exports = { register, login };