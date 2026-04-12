const prisma = require('../config/auth.config');
const bcrypt = require('bcrypt');
const { generateToken } = require('../utils/auth.utils');

const register = async (name, email, password) => {
    if (!name || !email || !password || name.trim() === '' || email.trim() === '' || password.trim() === '') {
        throw new Error('Name, email, and password are required');
    }

    const normalizedName = name.trim();
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
            name: normalizedName,
            email: normalizedEmail,
            password: hashedPassword,
        },
    });

    const token = generateToken(user.id);
    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
        token,
    };
};

const login = async (name, email, password) => {
    if (!name || !email || !password || name.trim() === '' || email.trim() === '' || password.trim() === '') {
        throw new Error('Name, email, and password are required');
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
        where: {
            name: normalizedName,
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
            name: existingUser.name,
            email: existingUser.email,
        },
        token,
    };
};

module.exports = { register, login };