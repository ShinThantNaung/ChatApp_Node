const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

const servicePath = path.resolve(__dirname, './auth.services.js');
const prismaConfigPath = path.resolve(__dirname, '../config/auth.config.js');
const resendConfigPath = path.resolve(__dirname, '../config/resend.config.js');
const authUtilsPath = path.resolve(__dirname, '../utils/auth.utils.js');

const loadServiceWithMocks = ({ prismaMock, resendConfigMock }) => {
    delete require.cache[servicePath];
    require.cache[prismaConfigPath] = {
        id: prismaConfigPath,
        filename: prismaConfigPath,
        loaded: true,
        exports: prismaMock,
    };
    require.cache[resendConfigPath] = {
        id: resendConfigPath,
        filename: resendConfigPath,
        loaded: true,
        exports: resendConfigMock || {
            getResendClient: () => ({
                emails: {
                    send: async () => undefined,
                },
            }),
            resendFromEmail: 'onboarding@resend.dev',
        },
    };
    require.cache[authUtilsPath] = {
        id: authUtilsPath,
        filename: authUtilsPath,
        loaded: true,
        exports: {
            generateToken: () => 'mock-token',
            verifyToken: () => ({ id: 'user-1' }),
        },
    };

    return require(servicePath);
};

test('register throws when username is shorter than 6 characters', async () => {
    const prismaMock = {
        user: {
            findUnique: async () => {
                throw new Error('findUnique should not be called for invalid username');
            },
        },
        emailVerification: {},
    };
    const service = loadServiceWithMocks({ prismaMock });

    await assert.rejects(
        () => service.register('user1', 'user@example.com', 'password123'),
        /Username must be at least 6 characters/
    );
});

test('login throws when password is shorter than 6 characters', async () => {
    const prismaMock = {
        user: {
            findFirst: async () => {
                throw new Error('findFirst should not be called for invalid password');
            },
        },
        emailVerification: {},
    };
    const service = loadServiceWithMocks({ prismaMock });

    await assert.rejects(
        () => service.login('username', 'user@example.com', 'pass1'),
        /Password must be at least 6 characters/
    );
});

test('sendVerification throws when email is missing', async () => {
    const prismaMock = {
        user: {},
        emailVerification: {},
    };
    const service = loadServiceWithMocks({ prismaMock });

    await assert.rejects(
        () => service.sendVerification('   '),
        /Email is required/
    );
});

test('sendVerification throws when user does not exist', async () => {
    const prismaMock = {
        user: {
            findUnique: async () => null,
        },
        emailVerification: {
            upsert: async () => {
                throw new Error('upsert should not be called');
            },
        },
    };
    const service = loadServiceWithMocks({ prismaMock });

    await assert.rejects(
        () => service.sendVerification('user@example.com'),
        /User does not exist/
    );
});

test('sendVerification hashes otp, stores expiry, and sends email', async () => {
    const upsertCalls = [];
    const sentEmails = [];

    const prismaMock = {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'user@example.com',
                isEmailVerified: false,
            }),
        },
        emailVerification: {
            upsert: async (args) => {
                upsertCalls.push(args);
                return { id: 'ver-1' };
            },
        },
    };

    const service = loadServiceWithMocks({
        prismaMock,
        resendConfigMock: {
            getResendClient: () => ({
                emails: {
                    send: async (payload) => {
                        sentEmails.push(payload);
                    },
                },
            }),
            resendFromEmail: 'onboarding@resend.dev',
        },
    });

    const originalRandomInt = crypto.randomInt;
    crypto.randomInt = () => 123456;

    try {
        const before = Date.now();
        const result = await service.sendVerification(' USER@EXAMPLE.COM ');
        const after = Date.now();

        assert.equal(result.message, 'Verification code sent successfully');
        assert.equal(upsertCalls.length, 1);
        assert.equal(sentEmails.length, 1);

        const upsertCall = upsertCalls[0];
        const expectedOtpHash = crypto.createHash('sha256').update('123456').digest('hex');

        assert.equal(upsertCall.where.userId, 'user-1');
        assert.equal(upsertCall.update.otpHash, expectedOtpHash);
        assert.equal(upsertCall.create.otpHash, expectedOtpHash);

        const expiresAtMs = upsertCall.update.expiresAt.getTime();
        assert.ok(expiresAtMs >= before + (9.5 * 60 * 1000));
        assert.ok(expiresAtMs <= after + (10.5 * 60 * 1000));

        assert.equal(sentEmails[0].subject, 'Verify your email');
        assert.match(sentEmails[0].text, /Your verification code:/);
        assert.match(sentEmails[0].text, /123456/);
        assert.match(sentEmails[0].text, /Expires in 10 minutes\./);
    } finally {
        crypto.randomInt = originalRandomInt;
    }
});

test('verifyEmailOtp throws when otp is not 6 digits', async () => {
    const prismaMock = {
        user: {
            findUnique: async () => {
                throw new Error('findUnique should not be called for invalid OTP format');
            },
        },
        emailVerification: {},
    };

    const service = loadServiceWithMocks({ prismaMock });

    await assert.rejects(
        () => service.verifyEmailOtp('user@example.com', '12a456'),
        /OTP must be a 6-digit code/
    );
});

test('verifyEmailOtp deletes expired code and throws', async () => {
    const deleteCalls = [];

    const prismaMock = {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'user@example.com',
                isEmailVerified: false,
            }),
        },
        emailVerification: {
            findUnique: async () => ({
                userId: 'user-1',
                otpHash: 'hash',
                expiresAt: new Date(Date.now() - 5000),
            }),
            delete: async (args) => {
                deleteCalls.push(args);
                return { id: 'ver-1' };
            },
        },
    };

    const service = loadServiceWithMocks({ prismaMock });

    await assert.rejects(
        () => service.verifyEmailOtp('user@example.com', '123456'),
        /Verification code expired/
    );

    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0].where.userId, 'user-1');
});

test('verifyEmailOtp throws when otp hash does not match', async () => {
    let transactionCalled = false;

    const prismaMock = {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'user@example.com',
                isEmailVerified: false,
            }),
            update: async () => ({ id: 'user-1' }),
        },
        emailVerification: {
            findUnique: async () => ({
                userId: 'user-1',
                otpHash: crypto.createHash('sha256').update('999999').digest('hex'),
                expiresAt: new Date(Date.now() + 60 * 1000),
            }),
            delete: async () => ({ id: 'ver-1' }),
        },
        $transaction: async () => {
            transactionCalled = true;
            return [];
        },
    };

    const service = loadServiceWithMocks({ prismaMock });

    await assert.rejects(
        () => service.verifyEmailOtp('user@example.com', '123456'),
        /Invalid verification code/
    );

    assert.equal(transactionCalled, false);
});

test('verifyEmailOtp marks user verified and deletes verification record', async () => {
    const updateCalls = [];
    const deleteCalls = [];
    const transactionCalls = [];
    const otp = '654321';

    const prismaMock = {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'user@example.com',
                isEmailVerified: false,
            }),
            update: async (args) => {
                updateCalls.push(args);
                return { id: 'user-1', ...args.data };
            },
        },
        emailVerification: {
            findUnique: async () => ({
                userId: 'user-1',
                otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            }),
            delete: async (args) => {
                deleteCalls.push(args);
                return { id: 'ver-1' };
            },
        },
        $transaction: async (ops) => {
            transactionCalls.push(ops);
            return ops;
        },
    };

    const service = loadServiceWithMocks({ prismaMock });

    const result = await service.verifyEmailOtp('user@example.com', otp);

    assert.equal(result.message, 'Email verified successfully');
    assert.equal(result.user.id, 'user-1');
    assert.equal(result.user.isEmailVerified, true);

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].where.id, 'user-1');
    assert.equal(updateCalls[0].data.isEmailVerified, true);

    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0].where.userId, 'user-1');

    assert.equal(transactionCalls.length, 1);
    assert.equal(transactionCalls[0].length, 2);
});