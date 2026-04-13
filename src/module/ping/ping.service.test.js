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
            findUnique: async () => null,
            create: async (args) => {
                createArgs.push(args);
                return { id: 'ping-1', ...args.data };
            },
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
            findUnique: async () => null,
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
