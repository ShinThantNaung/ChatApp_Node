const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, './auth.controller.js');
const servicePath = path.resolve(__dirname, '../services/auth.services.js');

const makeRes = () => ({
    statusCode: 0,
    payload: undefined,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(data) {
        this.payload = data;
        return this;
    },
});

const loadController = (serviceMock) => {
    delete require.cache[controllerPath];
    require.cache[servicePath] = {
        id: servicePath,
        filename: servicePath,
        loaded: true,
        exports: serviceMock,
    };

    return require(controllerPath);
};

test('sendVerification returns 200 when service succeeds', async () => {
    let receivedEmail = null;
    const serviceMock = {
        sendVerification: async (email) => {
            receivedEmail = email;
            return { message: 'Verification code sent successfully' };
        },
    };

    const controller = loadController(serviceMock);
    const req = { body: { email: 'user@example.com' } };
    const res = makeRes();

    await controller.sendVerification(req, res);

    assert.equal(receivedEmail, 'user@example.com');
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.message, 'Verification code sent successfully');
});

test('sendVerification maps input error to 422', async () => {
    const serviceMock = {
        sendVerification: async () => {
            throw new Error('Email is required');
        },
    };

    const controller = loadController(serviceMock);
    const req = { body: { email: '' } };
    const res = makeRes();

    await controller.sendVerification(req, res);

    assert.equal(res.statusCode, 422);
    assert.equal(res.payload.message, 'Email is required');
});

test('verifyEmailOtp returns 200 when service succeeds', async () => {
    let receivedArgs = null;
    const serviceMock = {
        verifyEmailOtp: async (email, otp) => {
            receivedArgs = { email, otp };
            return {
                message: 'Email verified successfully',
                user: {
                    id: 'user-1',
                    email,
                    isEmailVerified: true,
                },
            };
        },
    };

    const controller = loadController(serviceMock);
    const req = { body: { email: 'user@example.com', otp: '123456' } };
    const res = makeRes();

    await controller.verifyEmailOtp(req, res);

    assert.equal(receivedArgs.email, 'user@example.com');
    assert.equal(receivedArgs.otp, '123456');
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.message, 'Email verified successfully');
    assert.equal(res.payload.user.isEmailVerified, true);
});

test('verifyEmailOtp maps invalid code error to 401', async () => {
    const serviceMock = {
        verifyEmailOtp: async () => {
            throw new Error('Invalid verification code');
        },
    };

    const controller = loadController(serviceMock);
    const req = { body: { email: 'user@example.com', otp: '000000' } };
    const res = makeRes();

    await controller.verifyEmailOtp(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.message, 'Invalid verification code');
});

test('verifyEmailOtp maps expired code error to 410', async () => {
    const serviceMock = {
        verifyEmailOtp: async () => {
            throw new Error('Verification code expired');
        },
    };

    const controller = loadController(serviceMock);
    const req = { body: { email: 'user@example.com', otp: '000000' } };
    const res = makeRes();

    await controller.verifyEmailOtp(req, res);

    assert.equal(res.statusCode, 410);
    assert.equal(res.payload.message, 'Verification code expired');
});