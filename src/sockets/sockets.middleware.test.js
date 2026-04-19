const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const middlewarePath = path.resolve(__dirname, './sockets.middleware.js');
const prismaConfigPath = path.resolve(__dirname, '../module/auth/config/auth.config.js');
const authUtilsPath = path.resolve(__dirname, '../module/auth/utils/auth.utils.js');

const loadMiddlewareWithMocks = ({ prismaMock, verifyTokenMock }) => {
    delete require.cache[middlewarePath];
    require.cache[prismaConfigPath] = {
        id: prismaConfigPath,
        filename: prismaConfigPath,
        loaded: true,
        exports: prismaMock,
    };
    require.cache[authUtilsPath] = {
        id: authUtilsPath,
        filename: authUtilsPath,
        loaded: true,
        exports: { verifyToken: verifyTokenMock },
    };

    return require(middlewarePath);
};

test('socketAuth accepts bearer token from handshake.auth', async () => {
    const user = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        avatarUrl: null,
    };
    const { socketAuth } = loadMiddlewareWithMocks({
        prismaMock: { user: { findUnique: async () => user } },
        verifyTokenMock: () => ({ id: 'user-1' }),
    });

    const socket = {
        handshake: {
            auth: { token: 'Bearer abc-123' },
            headers: { authorization: 'Bearer should-not-be-used' },
        },
        data: {},
    };
    let nextArg = 'not-called';

    await socketAuth(socket, (err) => {
        nextArg = err;
    });

    assert.equal(nextArg, undefined);
    assert.deepEqual(socket.user, user);
});

test('socketAuth accepts token from authorization header', async () => {
    const user = {
        id: 'user-2',
        username: 'bob',
        email: 'bob@example.com',
        avatarUrl: null,
    };
    const { socketAuth } = loadMiddlewareWithMocks({
        prismaMock: { user: { findUnique: async () => user } },
        verifyTokenMock: () => ({ id: 'user-2' }),
    });

    const socket = {
        handshake: {
            headers: { authorization: 'plain-token' },
        },
        data: {},
    };
    let nextArg = 'not-called';

    await socketAuth(socket, (err) => {
        nextArg = err;
    });

    assert.equal(nextArg, undefined);
    assert.deepEqual(socket.user, user);
});

test('socketAuth rejects when no token is provided', async () => {
    const { socketAuth } = loadMiddlewareWithMocks({
        prismaMock: { user: { findUnique: async () => null } },
        verifyTokenMock: () => ({ id: 'user-1' }),
    });

    const socket = { handshake: {}, data: {} };
    let nextErr;

    await socketAuth(socket, (err) => {
        nextErr = err;
    });

    assert.equal(nextErr.message, 'Authentication error: No token provided');
});

test('socketAuth rejects when token is invalid', async () => {
    const { socketAuth } = loadMiddlewareWithMocks({
        prismaMock: { user: { findUnique: async () => null } },
        verifyTokenMock: () => {
            throw new Error('bad token');
        },
    });

    const socket = {
        handshake: {
            auth: { token: 'Bearer bad-token' },
        },
        data: {},
    };
    let nextErr;

    await socketAuth(socket, (err) => {
        nextErr = err;
    });

    assert.equal(nextErr.message, 'Authentication error: Invalid token');
});

test('socketAuth rejects when user cannot be found', async () => {
    const { socketAuth } = loadMiddlewareWithMocks({
        prismaMock: { user: { findUnique: async () => null } },
        verifyTokenMock: () => ({ id: 'user-404' }),
    });

    const socket = {
        handshake: {
            auth: { token: 'Bearer token-1' },
        },
        data: {},
    };
    let nextErr;

    await socketAuth(socket, (err) => {
        nextErr = err;
    });

    assert.equal(nextErr.message, 'Authentication error: User not found');
});

test('socketAuth attaches user to socket and calls next with no error', async () => {
    const user = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        avatarUrl: null,
    };
    const { socketAuth } = loadMiddlewareWithMocks({
        prismaMock: { user: { findUnique: async () => user } },
        verifyTokenMock: () => ({ id: 'user-1' }),
    });

    const socket = {
        handshake: {
            auth: { token: 'Bearer ok-token' },
        },
        data: {},
    };
    let nextArg = 'not-called';

    await socketAuth(socket, (err) => {
        nextArg = err;
    });

    assert.equal(nextArg, undefined);
    assert.deepEqual(socket.user, user);
    assert.deepEqual(socket.data.user, user);
});
