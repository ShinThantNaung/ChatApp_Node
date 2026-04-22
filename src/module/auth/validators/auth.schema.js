const { z } = require('zod');

const normalizedEmailSchema = z.string().trim().toLowerCase().email('Email is invalid').max(254, 'Email is too long');
const usernameSchema = z.string().trim().min(6, 'Username must be at least 6 characters').max(32, 'Username is too long');
const passwordSchema = z.string().trim().min(6, 'Password must be at least 6 characters').max(72, 'Password is too long');

const registerSchema = z.object({
    username: usernameSchema,
    email: normalizedEmailSchema,
    password: passwordSchema,
}).strict();

const loginSchema = z.object({
    username: usernameSchema,
    email: normalizedEmailSchema,
    password: passwordSchema,
}).strict();

const sendVerificationSchema = z.object({
    email: normalizedEmailSchema,
}).strict();

const verifyEmailOtpSchema = z.object({
    email: normalizedEmailSchema,
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
}).strict();

module.exports = {
    registerSchema,
    loginSchema,
    sendVerificationSchema,
    verifyEmailOtpSchema,
};