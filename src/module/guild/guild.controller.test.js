const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, './guild.controller.js');
const servicePath = path.resolve(__dirname, './guild.service.js');

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

test('createGuild returns 201 with created guild', async () => {
    const serviceMock = {
        createGuild: async (data, userId) => ({ id: 'guild-1', name: data.name, leaderId: userId }),
    };
    const controller = loadController(serviceMock);

    const req = {
        body: { name: 'Arena' },
        user: { id: 'user-1' },
    };
    const res = makeRes();

    await controller.createGuild(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.id, 'guild-1');
    assert.equal(res.payload.leaderId, 'user-1');
});

test('joinGuild maps already-member error to 409', async () => {
    const serviceMock = {
        joinGuild: async () => {
            throw new Error('Already a member of this guild');
        },
    };
    const controller = loadController(serviceMock);

    const req = {
        body: { guildId: 'guild-1' },
        user: { id: 'user-2' },
    };
    const res = makeRes();

    await controller.joinGuild(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.payload.message, 'Already a member of this guild');
});

test('leaveGuild returns 200 with success message', async () => {
    const serviceMock = {
        leaveGuild: async () => ({ message: 'Left the guild successfully' }),
    };
    const controller = loadController(serviceMock);

    const req = {
        body: { guildId: 'guild-1' },
        user: { id: 'user-3' },
    };
    const res = makeRes();

    await controller.leaveGuild(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.message, 'Successfully left the guild');
});
