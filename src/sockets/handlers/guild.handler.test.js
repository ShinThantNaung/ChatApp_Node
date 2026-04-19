const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const handlerPath = path.resolve(__dirname, './guild.handler.js');
const prismaPath = path.resolve(__dirname, '../../config/prisma.js');

const loadGuildHandlerWithPrismaMock = (prismaMock) => {
    delete require.cache[handlerPath];
    require.cache[prismaPath] = {
        id: prismaPath,
        filename: prismaPath,
        loaded: true,
        exports: prismaMock,
    };

    return require(handlerPath);
};

test('toGuildRoom and toUserRoom build expected room names', () => {
    const guildHandler = loadGuildHandlerWithPrismaMock({
        guildMember: { findMany: async () => [] },
    });

    assert.equal(guildHandler.toGuildRoom('g-1'), 'guild:g-1');
    assert.equal(guildHandler.toUserRoom('u-1'), 'user:u-1');
});

test('syncGuildRoomsForSocket syncs join/leave operations and emits guild list', async () => {
    const guildHandler = loadGuildHandlerWithPrismaMock({
        guildMember: {
            findMany: async () => [{ guildId: 'keep' }, { guildId: 'new' }],
        },
    });

    const leftRooms = [];
    const joinedRooms = [];
    const emitted = [];

    const socket = {
        user: { id: 'user-1' },
        data: {},
        rooms: new Set(['socket-id', 'guild:stale', 'guild:keep']),
        leave: async (room) => {
            leftRooms.push(room);
        },
        join: async (room) => {
            joinedRooms.push(room);
        },
        emit: (event, payload) => {
            emitted.push({ event, payload });
        },
    };

    const guildIds = await guildHandler.syncGuildRoomsForSocket(socket);

    assert.deepEqual(guildIds, ['keep', 'new']);
    assert.deepEqual(leftRooms, ['guild:stale']);
    assert.deepEqual(joinedRooms, ['guild:keep', 'guild:new']);
    assert.deepEqual(socket.data.guildIds, ['keep', 'new']);
    assert.deepEqual(emitted, [{ event: 'guild:rooms_synced', payload: { guildIds: ['keep', 'new'] } }]);
});

test('syncGuildRoomsForSocket throws when user is missing', async () => {
    const guildHandler = loadGuildHandlerWithPrismaMock({
        guildMember: { findMany: async () => [] },
    });

    await assert.rejects(
        () => guildHandler.syncGuildRoomsForSocket({ data: {}, rooms: new Set(), leave: async () => {}, join: async () => {}, emit: () => {} }),
        /Authentication required/
    );
});

test('handler emits authentication error when socket has no user', () => {
    const guildHandler = loadGuildHandlerWithPrismaMock({
        guildMember: { findMany: async () => [] },
    });

    const emitted = [];
    const onCalls = [];
    const socket = {
        data: {},
        emit: (event, payload) => emitted.push({ event, payload }),
        on: (...args) => onCalls.push(args),
        join: () => {},
    };

    guildHandler({}, socket);

    assert.deepEqual(emitted, [{ event: 'error', payload: 'Authentication error' }]);
    assert.equal(onCalls.length, 0);
});

test('handler joins user room and registers guild refresh handler', async () => {
    const guildHandler = loadGuildHandlerWithPrismaMock({
        guildMember: {
            findMany: async () => [{ guildId: 'guild-1' }],
        },
    });

    const joinedRooms = [];
    const handlers = new Map();
    const emitted = [];

    const socket = {
        user: { id: 'user-1' },
        data: {},
        rooms: new Set(['socket-id']),
        join: async (room) => {
            joinedRooms.push(room);
            socket.rooms.add(room);
        },
        leave: async () => {},
        emit: (event, payload) => emitted.push({ event, payload }),
        on: (event, handler) => handlers.set(event, handler),
    };

    guildHandler({}, socket);

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(joinedRooms[0], 'user:user-1');
    assert.equal(typeof handlers.get('guild:refresh_rooms'), 'function');
    assert.equal(emitted.some((entry) => entry.event === 'guild:rooms_synced'), true);

    await handlers.get('guild:refresh_rooms')();
    const syncedEvents = emitted.filter((entry) => entry.event === 'guild:rooms_synced');
    assert.equal(syncedEvents.length >= 2, true);
});
