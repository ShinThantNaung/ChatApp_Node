const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, './guild.service.js');
const configPath = path.resolve(__dirname, './guild.config.js');

const loadServiceWithPrismaMock = (prismaMock) => {
    delete require.cache[servicePath];
    require.cache[configPath] = {
        id: configPath,
        filename: configPath,
        loaded: true,
        exports: prismaMock,
    };
    return require(servicePath);
};

test('createGuild throws when payload is missing', async () => {
    const prismaMock = {
        guild: {},
        guildMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.createGuild(undefined, 'user-1'),
        /Guild payload is required/
    );
});

test('createGuild throws when guild name is shorter than 3 characters', async () => {
    const prismaMock = {
        guild: {
            findFirst: async () => {
                throw new Error('findFirst should not be called for invalid guild name');
            },
        },
        guildMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.createGuild({ name: 'AB' }, 'user-1'),
        /Guild name must be at least 3 characters/
    );
});

test('createGuild creates guild when name is available', async () => {
    const createArgs = [];
    const prismaMock = {
        guild: {
            findFirst: async () => null,
            create: async (args) => {
                createArgs.push(args);
                return { id: 'guild-1', ...args.data };
            },
        },
        guildMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const result = await service.createGuild({ name: 'Valor' }, 'user-1');

    assert.equal(result.id, 'guild-1');
    assert.equal(createArgs.length, 1);
    assert.equal(createArgs[0].data.name, 'Valor');
    assert.equal(createArgs[0].data.leaderId, 'user-1');
    assert.equal(createArgs[0].data.members.create.userId, 'user-1');
    assert.equal(createArgs[0].data.members.create.role, 'leader');
});

test('joinGuild throws when user is already a member', async () => {
    const prismaMock = {
        guild: {
            findUnique: async () => ({
                id: 'guild-1',
                members: [{ id: 'm-1', userId: 'user-1', role: 'member' }],
            }),
        },
        guildMember: {
            create: async () => {
                throw new Error('create should not be called');
            },
        },
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.joinGuild('guild-1', 'user-1'),
        /Already a member of this guild/
    );
});

test('leaveGuild throws when member is guild leader', async () => {
    const prismaMock = {
        guild: {
            findUnique: async () => ({
                id: 'guild-1',
                members: [{ id: 'm-1', userId: 'user-1', role: 'leader' }],
            }),
        },
        guildMember: {
            delete: async () => {
                throw new Error('delete should not be called');
            },
        },
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    await assert.rejects(
        () => service.leaveGuild('guild-1', 'user-1'),
        /Guild leader cannot leave the guild/
    );
});

test('deleteGuild deletes guild when requester is leader', async () => {
    const deletedIds = [];
    const prismaMock = {
        guild: {
            findUnique: async () => ({ id: 'guild-1', leaderId: 'user-1' }),
            delete: async ({ where }) => {
                deletedIds.push(where.id);
                return { id: where.id };
            },
        },
        guildMember: {},
    };
    const service = loadServiceWithPrismaMock(prismaMock);

    const result = await service.deleteGuild('guild-1', 'user-1');

    assert.equal(result.message, 'Guild deleted successfully');
    assert.deepEqual(deletedIds, ['guild-1']);
});
