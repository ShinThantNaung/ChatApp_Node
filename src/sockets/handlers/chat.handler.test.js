const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const handlerPath = path.resolve(__dirname, './chat.handler.js');
const prismaPath = path.resolve(__dirname, '../../config/prisma.js');

const loadChatHandlerWithPrismaMock = (prismaMock) => {
    delete require.cache[handlerPath];
    require.cache[prismaPath] = {
        id: prismaPath,
        filename: prismaPath,
        loaded: true,
        exports: prismaMock,
    };

    return require(handlerPath);
};

test('chat handler registers send_message and guild:send_message events', () => {
    const chatHandler = loadChatHandlerWithPrismaMock({
        guildMember: { findUnique: async () => ({ id: 'm-1' }) },
    });

    const handlers = new Map();
    const socket = {
        user: { id: 'user-1', username: 'alice', avatarUrl: null },
        on: (event, fn) => handlers.set(event, fn),
    };

    chatHandler({}, socket);

    assert.equal(typeof handlers.get('send_message'), 'function');
    assert.equal(typeof handlers.get('guild:send_message'), 'function');
});

test('chat handler emits error when guildId or content is missing', async () => {
    const chatHandler = loadChatHandlerWithPrismaMock({
        guildMember: { findUnique: async () => ({ id: 'm-1' }) },
    });

    const handlers = new Map();
    const emitted = [];
    const socket = {
        user: { id: 'user-1', username: 'alice', avatarUrl: null },
        on: (event, fn) => handlers.set(event, fn),
        emit: (event, payload) => emitted.push({ event, payload }),
        join: async () => {},
    };

    chatHandler({ to: () => ({ emit: () => {} }) }, socket);

    await handlers.get('send_message')({ guildId: '', content: '   ' });

    assert.deepEqual(emitted, [{ event: 'error', payload: 'Guild ID and content are required' }]);
});

test('chat handler emits error when sender is not guild member', async () => {
    const chatHandler = loadChatHandlerWithPrismaMock({
        guildMember: { findUnique: async () => null },
    });

    const handlers = new Map();
    const emitted = [];
    const socket = {
        user: { id: 'user-1', username: 'alice', avatarUrl: null },
        on: (event, fn) => handlers.set(event, fn),
        emit: (event, payload) => emitted.push({ event, payload }),
        join: async () => {},
    };

    chatHandler({ to: () => ({ emit: () => {} }) }, socket);

    await handlers.get('send_message')({ guildId: 'guild-1', content: 'Hello' });

    assert.deepEqual(emitted, [{ event: 'error', payload: 'You must join this guild before chatting' }]);
});

test('chat handler emits error when message is too long', async () => {
    const chatHandler = loadChatHandlerWithPrismaMock({
        guildMember: { findUnique: async () => ({ id: 'member-1' }) },
    });

    const handlers = new Map();
    const emitted = [];
    const ioEmits = [];
    const socket = {
        user: { id: 'user-1', username: 'alice', avatarUrl: null },
        on: (event, fn) => handlers.set(event, fn),
        emit: (event, payload) => emitted.push({ event, payload }),
        join: async () => {},
    };

    const io = {
        to: () => ({
            emit: (...args) => ioEmits.push(args),
        }),
    };

    chatHandler(io, socket);

    const oversized = 'x'.repeat(501);
    await handlers.get('send_message')({ guildId: 'guild-1', content: oversized });

    assert.deepEqual(emitted, [{ event: 'error', payload: 'Message is too long (max 500 characters)' }]);
    assert.equal(ioEmits.length, 0);
});

test('chat handler broadcasts normalized message to both guild events', async () => {
    const chatHandler = loadChatHandlerWithPrismaMock({
        guildMember: { findUnique: async () => ({ id: 'member-1' }) },
    });

    const handlers = new Map();
    const emits = [];
    const joinedRooms = [];

    const io = {
        to: (room) => ({
            emit: (event, payload) => {
                emits.push({ room, event, payload });
            },
        }),
    };

    const socket = {
        user: { id: 'user-1', username: 'alice', avatarUrl: null },
        on: (event, fn) => handlers.set(event, fn),
        emit: () => {},
        join: async (room) => {
            joinedRooms.push(room);
        },
    };

    chatHandler(io, socket);

    await handlers.get('send_message')({ guildId: 'guild-1', content: '  hi team  ' });

    assert.deepEqual(joinedRooms, ['guild:guild-1']);
    assert.equal(emits.length, 2);
    assert.equal(emits[0].event, 'new_message');
    assert.equal(emits[1].event, 'guild:new_message');
    assert.equal(emits[0].payload.content, 'hi team');
    assert.equal(emits[0].payload.sender.id, 'user-1');
    assert.equal(typeof emits[0].payload.createdAt, 'string');
    assert.equal(Number.isNaN(Date.parse(emits[0].payload.createdAt)), false);
});

test('chat handler emits failure when unexpected error is thrown', async () => {
    const chatHandler = loadChatHandlerWithPrismaMock({
        guildMember: {
            findUnique: async () => {
                throw new Error('db down');
            },
        },
    });

    const handlers = new Map();
    const emitted = [];
    const socket = {
        user: { id: 'user-1', username: 'alice', avatarUrl: null },
        on: (event, fn) => handlers.set(event, fn),
        emit: (event, payload) => emitted.push({ event, payload }),
        join: async () => {},
    };

    chatHandler({ to: () => ({ emit: () => {} }) }, socket);

    await handlers.get('send_message')({ guildId: 'guild-1', content: 'Hi' });

    assert.deepEqual(emitted, [{ event: 'error', payload: 'Failed to send message' }]);
});
