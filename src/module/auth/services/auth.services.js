const prisma = require('../config/auth.config');
const bcrypt = require('bcrypt');
const { generateToken } = require('../utils/auth.utils');

const register = async (username, email, password) => {
    if (!username || !email || !password || username.trim() === '' || email.trim() === '' || password.trim() === '') {
        throw new Error('Username, email, and password are required');
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (existingUser) {
        throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            username: normalizedUsername,
            email: normalizedEmail,
            password: hashedPassword,
        },
    });

    const token = generateToken(user.id);
    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
        },
        token,
    };
};

const login = async (username, email, password) => {
    if (!username || !email || !password || username.trim() === '' || email.trim() === '' || password.trim() === '') {
        throw new Error('Username, email, and password are required');
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
        where: {
            username: normalizedUsername,
            email: normalizedEmail,
        },
    });

    if (!existingUser) {
        throw new Error('User does not exist');
    }

    const isMatched = await bcrypt.compare(password, existingUser.password);
    if (!isMatched) {
        throw new Error('Invalid credentials');
    }

    const token = generateToken(existingUser.id);
    return {
        user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
        },
        token,
    };
};

module.exports = { register, login };