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

test('createPing allows creator to choose role by creatorRoleId', async () => {
    const createArgs = [];
    const prismaMock = {
        ping: {
            findFirst: async () => null,
            create: async (args) => {
                createArgs.push(args);
                return { id: 'ping-3', ...args.data };
            },
        },
        role: {
            findMany: async () => [
                { id: 'role-top-id', name: 'top' },
                { id: 'role-mid-id', name: 'mid' },
            ],
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const result = await service.createPing({
        title: 'Pick My Lane',
        gameMode: 'rank',
        maxPlayers: 5,
        creatorRoleId: 'role-mid-id',
        roles: [
            { roleId: 'role-top-id', slots: 1 },
            { roleId: 'role-mid-id', slots: 1 },
        ],
    }, 'user-1');

    assert.equal(result.id, 'ping-3');
    assert.equal(createArgs[0].data.members.create.roleId, 'role-mid-id');
});

test('createPing allows creator to choose role by creatorRoleName', async () => {
    const createArgs = [];
    const prismaMock = {
        ping: {
            findFirst: async () => null,
            create: async (args) => {
                createArgs.push(args);
                return { id: 'ping-4', ...args.data };
            },
        },
        role: {
            findMany: async () => [
                { id: 'role-jungle-id', name: 'jungle' },
                { id: 'role-support-id', name: 'support' },
            ],
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const result = await service.createPing({
        title: 'Pick by Name',
        gameMode: 'rank',
        maxPlayers: 5,
        creatorRoleName: 'Support',
        roles: [
            { roleName: 'jungle', slots: 1 },
            { roleName: 'support', slots: 1 },
        ],
    }, 'user-1');

    assert.equal(result.id, 'ping-4');
    assert.equal(createArgs[0].data.members.create.roleId, 'role-support-id');
});

test('createPing throws when creatorRoleId is not in ping roles', async () => {
    const prismaMock = {
        ping: {
            findFirst: async () => null,
            create: async () => {
                throw new Error('create should not be called');
            },
        },
        role: {
            findMany: async () => [
                { id: 'role-top-id', name: 'top' },
                { id: 'role-mid-id', name: 'mid' },
                { id: 'role-jungle-id', name: 'jungle' },
            ],
        },
        pingMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.createPing({
            title: 'Bad Creator Role',
            gameMode: 'rank',
            maxPlayers: 5,
            creatorRoleId: 'role-jungle-id',
            roles: [
                { roleId: 'role-top-id', slots: 1 },
                { roleId: 'role-mid-id', slots: 1 },
            ],
        }, 'user-1'),
        /Creator role must be one of the ping roles/
    );
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
    const updates = [];
    const tx = {
        $queryRaw: async () => [{ id: 'ping-1' }],
        ping: {
            findUnique: async () => ({
                id: 'ping-1',
                maxPlayers: 3,
                status: 'open',
                members: [{ userId: 'creator', roleId: 'jungle' }],
                roles: [
                    { roleId: 'jungle', slots: 1 },
                    { roleId: 'support', slots: 2 },
                ],
            }),
            update: async (args) => {
                updates.push(args);
                return args;
            },
        },
        pingMember: {
            create: async ({ data }) => ({ id: 'member-2', ...data }),
        },
    };

    const prismaMock = {
        $transaction: async (callback) => callback(tx),
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const member = await service.joinPing('ping-1', 'user-2');

    assert.equal(member.userId, 'user-2');
    assert.equal(member.pingId, 'ping-1');
    assert.equal(member.roleId, 'support');
    assert.equal(updates.length, 0);
});

test('joinPing prevents overflow when two users join at the same time', async () => {
    const state = {
        pingId: 'ping-1',
        maxPlayers: 2,
        status: 'open',
        members: [{ id: 'member-1', userId: 'creator', roleId: 'jungle', status: 'joined' }],
        roles: [
            { roleId: 'jungle', slots: 1 },
            { roleId: 'support', slots: 1 },
        ],
    };

    const tx = {
        $queryRaw: async () => [{ id: state.pingId }],
        ping: {
            findUnique: async () => ({
                id: state.pingId,
                maxPlayers: state.maxPlayers,
                status: state.status,
                members: [...state.members],
                roles: [...state.roles],
            }),
            update: async ({ data }) => {
                state.status = data.status;
                return { id: state.pingId, status: state.status };
            },
        },
        pingMember: {
            create: async ({ data }) => {
                const newMember = { id: `member-${state.members.length + 1}`, ...data };
                state.members.push(newMember);
                return newMember;
            },
        },
    };

    let queue = Promise.resolve();
    const prismaMock = {
        $transaction: async (callback) => {
            const run = queue.then(() => callback(tx));
            queue = run.catch(() => undefined);
            return run;
        },
    };

    const service = loadServiceWithPrismaMock(prismaMock);

    const [first, second] = await Promise.allSettled([
        service.joinPing('ping-1', 'user-2'),
        service.joinPing('ping-1', 'user-3'),
    ]);

    const fulfilled = [first, second].filter((r) => r.status === 'fulfilled');
    const rejected = [first, second].filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].reason.message, /Ping is full|No available roles/);
    assert.equal(state.members.length, 2);
    assert.equal(state.status, 'closed');
});

test('joinPing closes ping when final required role is filled', async () => {
    const updates = [];
    const tx = {
        $queryRaw: async () => [{ id: 'ping-1' }],
        ping: {
            findUnique: async () => ({
                id: 'ping-1',
                maxPlayers: 5,
                status: 'open',
                members: [{ userId: 'creator', roleId: 'jungle' }],
                roles: [
                    { roleId: 'jungle', slots: 1 },
                    { roleId: 'support', slots: 1 },
                ],
            }),
            update: async (args) => {
                updates.push(args);
                return args;
            },
        },
        pingMember: {
            create: async ({ data }) => ({ id: 'member-2', ...data }),
        },
    };

    const prismaMock = {
        $transaction: async (callback) => callback(tx),
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const member = await service.joinPing('ping-1', 'user-2');

    assert.equal(member.roleId, 'support');
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.status, 'closed');
});

test('leavePing throws when member is not part of ping', async () => {
    const tx = {
        $queryRaw: async () => [{ id: 'ping-1' }],
        ping: {
            findUnique: async () => ({
                id: 'ping-1',
                maxPlayers: 3,
                status: 'open',
                members: [{ id: 'member-1', userId: 'someone-else', roleId: 'jungle', status: 'joined' }],
                roles: [{ roleId: 'jungle', slots: 2 }],
            }),
            update: async () => {
                throw new Error('update should not be called');
            },
        },
        pingMember: {
            delete: async () => {
                throw new Error('delete should not be called');
            },
        },
    };

    const prismaMock = {
        $transaction: async (callback) => callback(tx),
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.leavePing('ping-1', 'user-404'),
        /Not a member of this ping/
    );
});

test('leavePing reopens ping when a member leaves and slots are available again', async () => {
    const updates = [];
    const tx = {
        $queryRaw: async () => [{ id: 'ping-1' }],
        ping: {
            findUnique: async () => ({
                id: 'ping-1',
                maxPlayers: 2,
                status: 'closed',
                members: [
                    { id: 'member-1', userId: 'creator', roleId: 'jungle', status: 'joined' },
                    { id: 'member-2', userId: 'user-2', roleId: 'support', status: 'joined' },
                ],
                roles: [
                    { roleId: 'jungle', slots: 1 },
                    { roleId: 'support', slots: 1 },
                ],
            }),
            update: async (args) => {
                updates.push(args);
                return args;
            },
        },
        pingMember: {
            delete: async () => ({ id: 'member-2' }),
        },
    };

    const prismaMock = {
        $transaction: async (callback) => callback(tx),
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const result = await service.leavePing('ping-1', 'user-2');

    assert.equal(result.message, 'Left ping successfully');
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.status, 'open');
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
