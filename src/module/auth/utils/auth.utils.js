const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET;

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, secret, { expiresIn: '1h' });
};

module.exports = { generateToken };