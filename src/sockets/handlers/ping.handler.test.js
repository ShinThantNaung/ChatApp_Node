const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const handlerPath = path.resolve(__dirname, './ping.handler.js');
const prismaPath = path.resolve(__dirname, '../../config/prisma.js');

const loadPingHandlerWithPrismaMock = (prismaMock) => {
    delete require.cache[handlerPath];
    require.cache[prismaPath] = {
        id: prismaPath,
        filename: prismaPath,
        loaded: true,
        exports: prismaMock,
    };

    return require(handlerPath);
};

test('ping handler registers join_ping event', () => {
    const pingHandler = loadPingHandlerWithPrismaMock({
        ping: { findUnique: async () => ({ id: 'ping-1', members: [{ id: 'm-1' }] }) },
    });

    const handlers = new Map();
    const socket = {
        user: { id: 'user-1' },
        on: (event, fn) => handlers.set(event, fn),
    };

    pingHandler({}, socket);

    assert.equal(typeof handlers.get('join_ping'), 'function');
});

test('ping handler emits error when pingId is missing', async () => {
    const pingHandler = loadPingHandlerWithPrismaMock({
        ping: { findUnique: async () => ({ id: 'ping-1', members: [{ id: 'm-1' }] }) },
    });

    const handlers = new Map();
    const emitted = [];

    const socket = {
        user: { id: 'user-1' },
        on: (event, fn) => handlers.set(event, fn),
        emit: (event, payload) => emitted.push({ event, payload }),
    };

    pingHandler({}, socket);

    await handlers.get('join_ping')('   ');

    assert.deepEqual(emitted, [{ event: 'error', payload: 'Ping ID is required' }]);
});

test('ping handler does not join when ping does not exist', async () => {
    const pingHandler = loadPingHandlerWithPrismaMock({
        ping: { findUnique: async () => null },
    });

    const handlers = new Map();
    const emitted = [];
    const joinedRooms = [];

    const socket = {
        user: { id: 'user-1' },
        on: (event, fn) => handlers.set(event, fn),
        emit: (event, payload) => emitted.push({ event, payload }),
        join: async (room) => joinedRooms.push(room),
        to: () => ({ emit: () => {} }),
    };

    pingHandler({}, socket);

    await handlers.get('join_ping')('ping-404');

    assert.deepEqual(emitted, [{ event: 'error', payload: 'Ping does not exist' }]);
    assert.deepEqual(joinedRooms, []);
});

test('ping handler does not join when user is not ping member', async () => {
    const pingHandler = loadPingHandlerWithPrismaMock({
        ping: { findUnique: async () => ({ id: 'ping-1', members: [] }) },
    });

    const handlers = new Map();
    const emitted = [];
    const joinedRooms = [];

    const socket = {
        user: { id: 'user-1' },
        on: (event, fn) => handlers.set(event, fn),
        emit: (event, payload) => emitted.push({ event, payload }),
        join: async (room) => joinedRooms.push(room),
        to: () => ({ emit: () => {} }),
    };

    pingHandler({}, socket);

    await handlers.get('join_ping')('ping-1');

    assert.deepEqual(emitted, [{ event: 'error', payload: 'Not a squad member' }]);
    assert.deepEqual(joinedRooms, []);
});

test('ping handler joins and emits ping:joined for authorized member', async () => {
    const pingHandler = loadPingHandlerWithPrismaMock({
        ping: {
            findUnique: async () => ({
                id: 'ping-1',
                members: [{ id: 'member-1' }],
            }),
        },
    });

    const handlers = new Map();
    const joinedRooms = [];
    const roomEmits = [];

    const socket = {
        user: { id: 'user-1' },
        on: (event, fn) => handlers.set(event, fn),
        emit: () => {},
        join: async (room) => joinedRooms.push(room),
        to: (room) => ({
            emit: (event, payload) => roomEmits.push({ room, event, payload }),
        }),
    };

    pingHandler({}, socket);

    await handlers.get('join_ping')(' ping-1 ');

    assert.deepEqual(joinedRooms, ['ping-1']);
    assert.deepEqual(roomEmits, [{ room: 'ping-1', event: 'ping:joined', payload: { userId: 'user-1' } }]);
});
