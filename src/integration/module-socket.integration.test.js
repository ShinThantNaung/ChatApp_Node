const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const guildServicePath = path.resolve(__dirname, '../module/guild/guild.service.js');
const guildConfigPath = path.resolve(__dirname, '../module/guild/guild.config.js');
const guildHandlerPath = path.resolve(__dirname, '../sockets/handlers/guild.handler.js');
const chatHandlerPath = path.resolve(__dirname, '../sockets/handlers/chat.handler.js');
const prismaConfigPath = path.resolve(__dirname, '../config/prisma.js');

const tick = () => new Promise((resolve) => setImmediate(resolve));

const createPrismaMock = (seed) => {
    const state = {
        guilds: [...(seed.guilds || [])],
        guildMembers: [...(seed.guildMembers || [])],
    };
    let nextMemberId = state.guildMembers.length + 1;

    const listMembers = (guildId) => state.guildMembers.filter((member) => member.guildId === guildId).map((member) => ({ ...member }));

    const prismaMock = {
        guild: {
            findFirst: async ({ where } = {}) => {
                if (!where?.name) {
                    return null;
                }

                const guild = state.guilds.find((entry) => entry.name === where.name);
                return guild ? { ...guild } : null;
            },
            findUnique: async ({ where, include } = {}) => {
                const guild = state.guilds.find((entry) => entry.id === where?.id);
                if (!guild) {
                    return null;
                }

                const result = { ...guild };
                if (include?.members) {
                    result.members = listMembers(guild.id);
                }
                return result;
            },
            create: async ({ data }) => {
                const newGuild = {
                    id: data.id || `guild-${state.guilds.length + 1}`,
                    name: data.name,
                    leaderId: data.leaderId,
                };
                state.guilds.push(newGuild);

                if (data.members?.create) {
                    state.guildMembers.push({
                        id: `member-${nextMemberId++}`,
                        guildId: newGuild.id,
                        userId: data.members.create.userId,
                        role: data.members.create.role,
                    });
                }

                return { ...newGuild, members: listMembers(newGuild.id) };
            },
            delete: async ({ where }) => {
                const index = state.guilds.findIndex((entry) => entry.id === where?.id);
                if (index < 0) {
                    return null;
                }

                const [deletedGuild] = state.guilds.splice(index, 1);
                return { ...deletedGuild };
            },
        },
        guildMember: {
            findMany: async ({ where, select } = {}) => {
                const userId = where?.userId;
                const rows = state.guildMembers
                    .filter((entry) => (userId ? entry.userId === userId : true))
                    .map((entry) => ({ ...entry }));

                if (select?.guildId) {
                    return rows.map((entry) => ({ guildId: entry.guildId }));
                }

                return rows;
            },
            findUnique: async ({ where, select } = {}) => {
                const userId = where?.userId_guildId?.userId;
                const guildId = where?.userId_guildId?.guildId;
                const row = state.guildMembers.find((entry) => entry.userId === userId && entry.guildId === guildId);
                if (!row) {
                    return null;
                }

                if (select?.id) {
                    return { id: row.id };
                }

                return { ...row };
            },
            create: async ({ data }) => {
                const newMember = {
                    id: data.id || `member-${nextMemberId++}`,
                    guildId: data.guildId,
                    userId: data.userId,
                    role: data.role || 'member',
                };
                state.guildMembers.push(newMember);
                return { ...newMember };
            },
            delete: async ({ where }) => {
                const index = state.guildMembers.findIndex((entry) => entry.id === where?.id);
                if (index < 0) {
                    return null;
                }

                const [deletedMember] = state.guildMembers.splice(index, 1);
                return { ...deletedMember };
            },
            deleteMany: async ({ where } = {}) => {
                const guildId = where?.guildId;
                const beforeCount = state.guildMembers.length;
                state.guildMembers = state.guildMembers.filter((entry) => (guildId ? entry.guildId !== guildId : false));

                return { count: beforeCount - state.guildMembers.length };
            },
        },
    };

    prismaMock.$transaction = async (ops) => {
        if (typeof ops === 'function') {
            return ops(prismaMock);
        }
        return Promise.all(ops);
    };

    return { prismaMock, state };
};

const loadIntegrationModules = (prismaMock) => {
    delete require.cache[guildServicePath];
    delete require.cache[guildHandlerPath];
    delete require.cache[chatHandlerPath];

    require.cache[guildConfigPath] = {
        id: guildConfigPath,
        filename: guildConfigPath,
        loaded: true,
        exports: prismaMock,
    };
    require.cache[prismaConfigPath] = {
        id: prismaConfigPath,
        filename: prismaConfigPath,
        loaded: true,
        exports: prismaMock,
    };

    return {
        guildService: require(guildServicePath),
        guildHandler: require(guildHandlerPath),
        chatHandler: require(chatHandlerPath),
    };
};

const createSocketHarness = ({ user, initialRooms = [] } = {}) => {
    const handlers = new Map();
    const socketEmits = [];
    const joinedRooms = [];
    const leftRooms = [];
    const rooms = new Set(initialRooms);

    const socket = {
        user,
        data: {},
        rooms,
        on: (event, handler) => handlers.set(event, handler),
        emit: (event, payload) => socketEmits.push({ event, payload }),
        join: async (room) => {
            joinedRooms.push(room);
            rooms.add(room);
        },
        leave: async (room) => {
            leftRooms.push(room);
            rooms.delete(room);
        },
    };

    return { socket, handlers, socketEmits, joinedRooms, leftRooms };
};

const createIoHarness = () => {
    const ioEmits = [];
    return {
        ioEmits,
        io: {
            to: (room) => ({
                emit: (event, payload) => ioEmits.push({ room, event, payload }),
            }),
        },
    };
};

test('integration: join guild via service enables guild room sync and chat broadcast', async () => {
    const { prismaMock, state } = createPrismaMock({
        guilds: [{ id: 'guild-1', name: 'Legends', leaderId: 'leader-1' }],
        guildMembers: [{ id: 'member-1', guildId: 'guild-1', userId: 'leader-1', role: 'leader' }],
    });
    const { guildService, guildHandler, chatHandler } = loadIntegrationModules(prismaMock);
    const { io, ioEmits } = createIoHarness();
    const { socket, handlers, socketEmits } = createSocketHarness({
        user: { id: 'user-2', username: 'bob', avatarUrl: null },
        initialRooms: ['socket-user-2'],
    });

    const joinedMember = await guildService.joinGuild('guild-1', 'user-2');
    assert.equal(joinedMember.guildId, 'guild-1');
    assert.equal(state.guildMembers.some((entry) => entry.userId === 'user-2' && entry.guildId === 'guild-1'), true);

    guildHandler(io, socket);
    chatHandler(io, socket);
    await tick();

    assert.equal(socket.rooms.has('user:user-2'), true);
    assert.equal(socket.rooms.has('guild:guild-1'), true);
    assert.deepEqual(socket.data.guildIds, ['guild-1']);
    assert.equal(typeof handlers.get('send_message'), 'function');

    await handlers.get('send_message')({ guildId: 'guild-1', content: '  hello guild  ' });

    const messageEvents = ioEmits.filter((entry) => entry.event === 'new_message' || entry.event === 'guild:new_message');
    assert.equal(messageEvents.length, 2);
    assert.equal(messageEvents[0].room, 'guild:guild-1');
    assert.equal(messageEvents[0].payload.content, 'hello guild');
    assert.equal(messageEvents[0].payload.sender.id, 'user-2');
    assert.equal(socketEmits.some((entry) => entry.event === 'error'), false);
});

test('integration: leaving guild via service refreshes rooms and blocks guild chat', async () => {
    const { prismaMock } = createPrismaMock({
        guilds: [{ id: 'guild-1', name: 'Legends', leaderId: 'leader-1' }],
        guildMembers: [
            { id: 'member-1', guildId: 'guild-1', userId: 'leader-1', role: 'leader' },
            { id: 'member-2', guildId: 'guild-1', userId: 'user-2', role: 'member' },
        ],
    });
    const { guildService, guildHandler, chatHandler } = loadIntegrationModules(prismaMock);
    const { io, ioEmits } = createIoHarness();
    const { socket, handlers, socketEmits, leftRooms } = createSocketHarness({
        user: { id: 'user-2', username: 'bob', avatarUrl: null },
        initialRooms: ['socket-user-2', 'guild:guild-1'],
    });

    guildHandler(io, socket);
    chatHandler(io, socket);
    await tick();

    await guildService.leaveGuild('guild-1', 'user-2');
    await handlers.get('guild:refresh_rooms')();

    assert.equal(leftRooms.includes('guild:guild-1'), true);
    assert.equal(socket.rooms.has('guild:guild-1'), false);
    assert.deepEqual(socket.data.guildIds, []);

    await handlers.get('guild:send_message')({ guildId: 'guild-1', content: 'after leave' });

    const denied = socketEmits.find((entry) => entry.event === 'error' && entry.payload === 'You must join this guild before chatting');
    assert.ok(denied);
    assert.equal(ioEmits.some((entry) => entry.event === 'new_message' || entry.event === 'guild:new_message'), false);
});