const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET;

if (!secret) {
    throw new Error('JWT_SECRET is not configured');
}

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, secret, { expiresIn: '1h' });
};

const verifyToken = (token) => {
    return jwt.verify(token, secret);
};

module.exports = { generateToken, verifyToken };