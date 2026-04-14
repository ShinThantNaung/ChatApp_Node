const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, './ping.service.js');
const prismaConfigPath = path.resolve(__dirname, './ping.config.js');

const loadServiceWithPrismaMock = (prismaMock) => {
    delete require.cache[servicePath];
    require.cache[prismaConfigPath] = {
        id: prismaConfigPath,
        filename: prismaConfigPath,
        loaded: true,
        exports: prismaMock,
    };
    return require(servicePath);
};

test('createPing throws when payload is missing', async () => {
    const prismaMock = {
        ping: {},
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.createPing(undefined, 'user-1'),
        /Ping payload is required/
    );
});

test('createPing creates ping with trimmed title and creator as first member', async () => {
    const createArgs = [];
    const prismaMock = {
        ping: {
            findFirst: async () => null,
            create: async (args) => {
                createArgs.push(args);
                return { id: 'ping-1', ...args.data };
            },
        },
        role: {
            findMany: async () => [{ id: 'top', name: 'Top' }],
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const payload = {
        title: '  Ranked  ',
        gameMode: 'duo',
        maxPlayers: 5,
        roles: [{ roleId: 'top', slots: 2 }],
    };

    const result = await service.createPing(payload, 'user-1');

    assert.equal(result.id, 'ping-1');
    assert.equal(createArgs.length, 1);
    assert.equal(createArgs[0].data.title, 'Ranked');
    assert.equal(createArgs[0].data.creatorId, 'user-1');
    assert.equal(createArgs[0].data.members.create.userId, 'user-1');
    assert.equal(createArgs[0].data.members.create.roleId, 'top');
});

test('createPing throws when provided roleIds do not exist', async () => {
    const prismaMock = {
        ping: {
            findFirst: async () => null,
            create: async () => {
                throw new Error('create should not be called');
            },
        },
        role: {
            findMany: async () => [],
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.createPing({
            title: 'Rank Push',
            gameMode: 'rank',
            maxPlayers: 5,
            roles: [{ roleId: 'ROLE_ID_1', slots: 1 }],
        }, 'user-1'),
        /One or more roles are invalid/
    );
});

test('createPing accepts role names and resolves them to role ids', async () => {
    const createArgs = [];
    const prismaMock = {
        ping: {
            findFirst: async () => null,
            create: async (args) => {
                createArgs.push(args);
                return { id: 'ping-2', ...args.data };
            },
        },
        role: {
            findMany: async () => [
                { id: 'role-mid-id', name: 'mid' },
                { id: 'role-jungle-id', name: 'jungle' },
            ],
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const result = await service.createPing({
        title: 'Rank Team',
        gameMode: 'rank',
        maxPlayers: 5,
        roles: [
            { role: 'mid', slots: 1 },
            { roleName: 'jungle', slots: 1 },
        ],
    }, 'user-1');

    assert.equal(result.id, 'ping-2');
    assert.equal(createArgs[0].data.roles.create[0].roleId, 'role-mid-id');
    assert.equal(createArgs[0].data.roles.create[1].roleId, 'role-jungle-id');
    assert.equal(createArgs[0].data.members.create.roleId, 'role-mid-id');
});

test('createPing throws when role payload misses role identifier', async () => {
    const prismaMock = {
        ping: {
            findFirst: async () => null,
            create: async () => {
                throw new Error('create should not be called');
            },
        },
        role: {
            findMany: async () => [],
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.createPing({
            title: 'Rank Push',
            gameMode: 'rank',
            maxPlayers: 5,
            roles: [{ slots: 1 }],
        }, 'user-1'),
        /Each role must include roleId or role name, and slots > 0/
    );
});

test('joinPing assigns first available role', async () => {
    const prismaMock = {
        ping: {
            findUnique: async () => ({
                id: 'ping-1',
                maxPlayers: 3,
                members: [{ userId: 'creator', roleId: 'jungle' }],
                roles: [
                    { roleId: 'jungle', slots: 1 },
                    { roleId: 'support', slots: 2 },
                ],
            }),
        },
        pingMember: {
            create: async ({ data }) => ({ id: 'member-2', ...data }),
        },
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const member = await service.joinPing('ping-1', 'user-2');

    assert.equal(member.userId, 'user-2');
    assert.equal(member.pingId, 'ping-1');
    assert.equal(member.roleId, 'support');
});

test('leavePing throws when member is not part of ping', async () => {
    const prismaMock = {
        ping: {},
        pingMember: {
            findFirst: async () => null,
            delete: async () => {
                throw new Error('delete should not be called');
            },
        },
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.leavePing('ping-1', 'user-404'),
        /Not a member of this ping/
    );
});

test('deletePing deletes ping when requester is creator', async () => {
    let transactionCalls = 0;
    const prismaMock = {
        $transaction: async (ops) => {
            transactionCalls += 1;
            for (const op of ops) {
                await op;
            }
        },
        ping: {
            findUnique: async () => ({ id: 'ping-1', creatorId: 'user-1' }),
            delete: async ({ where }) => ({ id: where.id }),
        },
        pingRole: {
            deleteMany: async () => ({ count: 1 }),
        },
        message: {
            deleteMany: async () => ({ count: 0 }),
        },
        pingMember: {},
    };
    prismaMock.pingMember.deleteMany = async () => ({ count: 1 });
    const service = loadServiceWithPrismaMock(prismaMock);

    const result = await service.deletePing('ping-1', 'user-1');

    assert.equal(result.message, 'Ping deleted successfully');
    assert.equal(transactionCalls, 1);
});

test('deletePing throws when requester is not creator', async () => {
    const prismaMock = {
        ping: {
            findUnique: async () => ({ id: 'ping-1', creatorId: 'owner-user' }),
            delete: async () => {
                throw new Error('delete should not be called');
            },
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.deletePing('ping-1', 'user-2'),
        /Only the creator can delete this ping/
    );
});
