const prisma = require('../config/auth.config');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { z } = require('zod');
const { generateToken } = require('../utils/auth.utils');
const { getResendClient, resendFromEmail } = require('../config/resend.config');
const { logAuditEvent } = require('../../../utils/audit.logger');

const OTP_EXPIRY_MINUTES = 10;
const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;
const otpSecurityState = new Map();

const authCredentialsSchema = z.object({
    username: z.string().trim().min(6, 'Username must be at least 6 characters'),
    password: z.string().trim().min(6, 'Password must be at least 6 characters'),
});

const validateAuthCredentials = (username, password) => {
    const parsed = authCredentialsSchema.safeParse({ username, password });

    if (!parsed.success) {
        throw new Error(parsed.error.issues?.[0]?.message || 'Invalid credentials payload');
    }

    return parsed.data;
};

const generateOtpCode = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0');

const hashOtpCode = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const getOtpState = (email) => {
    const state = otpSecurityState.get(email);

    if (!state) {
        return {
            failedAttempts: 0,
            lastSentAt: 0,
            lockedUntil: 0,
        };
    }

    if (state.lockedUntil && state.lockedUntil <= Date.now()) {
        otpSecurityState.delete(email);
        return {
            failedAttempts: 0,
            lastSentAt: 0,
            lockedUntil: 0,
        };
    }

    return state;
};

const setOtpState = (email, state) => {
    otpSecurityState.set(email, state);
};

const clearOtpState = (email) => {
    otpSecurityState.delete(email);
};

const register = async (username, email, password) => {
    if (!username || !email || !password || username.trim() === '' || email.trim() === '' || password.trim() === '') {
        throw new Error('Username, email, and password are required');
    }

    const validatedCredentials = validateAuthCredentials(username, password);
    const normalizedUsername = validatedCredentials.username;
    const normalizedPassword = validatedCredentials.password;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (existingUser) {
        throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
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
            isEmailVerified: user.isEmailVerified,
        },
        token,
    };
};

const login = async (username, email, password) => {
    if (!username || !email || !password || username.trim() === '' || email.trim() === '' || password.trim() === '') {
        throw new Error('Username, email, and password are required');
    }

    const validatedCredentials = validateAuthCredentials(username, password);
    const normalizedUsername = validatedCredentials.username;
    const normalizedPassword = validatedCredentials.password;
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

    const isMatched = await bcrypt.compare(normalizedPassword, existingUser.password);
    if (!isMatched) {
        throw new Error('Invalid credentials');
    }

    const token = generateToken(existingUser.id);
    return {
        user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            isEmailVerified: existingUser.isEmailVerified,
        },
        token,
    };
};

const sendVerification = async (email) => {
    if (!email || email.trim() === '') {
        throw new Error('Email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const state = getOtpState(normalizedEmail);

    if (state.lockedUntil && state.lockedUntil > Date.now()) {
        logAuditEvent('auth.otp.denied', {
            reason: 'locked',
        });
        throw new Error('Too many failed attempts. Try again later');
    }

    if (state.lastSentAt && Date.now() - state.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
        logAuditEvent('auth.otp.denied', {
            reason: 'resend_cooldown',
        });
        throw new Error('Please wait before requesting a new verification code');
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
            id: true,
            email: true,
            isEmailVerified: true,
        },
    });

    if (!existingUser) {
        throw new Error('User does not exist');
    }

    if (existingUser.isEmailVerified) {
        throw new Error('Email is already verified');
    }

    const otpCode = generateOtpCode();
    const otpHash = hashOtpCode(otpCode);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await prisma.emailVerification.upsert({
        where: { userId: existingUser.id },
        update: { otpHash, expiresAt },
        create: {
            userId: existingUser.id,
            otpHash,
            expiresAt,
        },
    });

    const resendClient = getResendClient();

    await resendClient.emails.send({
        from: resendFromEmail,
        to: existingUser.email,
        subject: 'Verify your email',
        text: `Your verification code:\n\n${otpCode}\n\nExpires in 10 minutes.`,
    });

    setOtpState(normalizedEmail, {
        ...state,
        failedAttempts: 0,
        lockedUntil: 0,
        lastSentAt: Date.now(),
    });

    return { message: 'Verification code sent successfully' };
};

const verifyEmailOtp = async (email, otp) => {
    if (!email || email.trim() === '') {
        throw new Error('Email is required');
    }

    if (!otp || otp.trim() === '') {
        throw new Error('OTP is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();
    const state = getOtpState(normalizedEmail);

    if (state.lockedUntil && state.lockedUntil > Date.now()) {
        logAuditEvent('auth.otp.denied', {
            reason: 'locked',
        });
        throw new Error('Too many failed attempts. Try again later');
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
        throw new Error('OTP must be a 6-digit code');
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
            id: true,
            email: true,
            isEmailVerified: true,
        },
    });

    if (!existingUser) {
        throw new Error('User does not exist');
    }

    if (existingUser.isEmailVerified) {
        throw new Error('Email is already verified');
    }

    const verificationRecord = await prisma.emailVerification.findUnique({
        where: { userId: existingUser.id },
        select: {
            userId: true,
            otpHash: true,
            expiresAt: true,
        },
    });

    if (!verificationRecord) {
        throw new Error('Verification code not found');
    }

    if (verificationRecord.expiresAt.getTime() <= Date.now()) {
        await prisma.emailVerification.delete({
            where: { userId: existingUser.id },
        });

        logAuditEvent('auth.otp.failure', {
            reason: 'expired_code',
            userId: existingUser.id,
        });
        throw new Error('Verification code expired');
    }

    const hashedOtp = hashOtpCode(normalizedOtp);

    if (hashedOtp !== verificationRecord.otpHash) {
        const failedAttempts = (state.failedAttempts || 0) + 1;
        const nextState = {
            ...state,
            failedAttempts,
        };

        if (failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
            nextState.lockedUntil = Date.now() + OTP_LOCKOUT_MS;
        }

        setOtpState(normalizedEmail, nextState);
        logAuditEvent('auth.otp.failure', {
            reason: 'invalid_code',
            userId: existingUser.id,
            failedAttempts,
        });

        if (failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
            throw new Error('Too many failed attempts. Try again later');
        }

        throw new Error('Invalid verification code');
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: existingUser.id },
            data: { isEmailVerified: true },
        }),
        prisma.emailVerification.delete({
            where: { userId: existingUser.id },
        }),
    ]);

    clearOtpState(normalizedEmail);

    return {
        message: 'Email verified successfully',
        user: {
            id: existingUser.id,
            email: existingUser.email,
            isEmailVerified: true,
        },
    };
};

module.exports = { register, login, sendVerification, verifyEmailOtp };