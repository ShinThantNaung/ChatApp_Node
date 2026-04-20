const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, './mlbbAcademy.controller.js');
const servicePath = path.resolve(__dirname, './mlbbAcademy.services.js');

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

test('getGlobalTopHero returns 200 with top hero payload', async () => {
    const serviceMock = {
        getGlobalTopHero: async () => ({ id: 1, name: 'Alpha', winRate: '58.1' }),
    };
    const controller = loadController(serviceMock);

    const req = { query: { rank: 'mythic' } };
    const res = makeRes();

    await controller.getGlobalTopHero(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.id, 1);
    assert.equal(res.payload.name, 'Alpha');
});

test('getGlobalTopHero maps bad request errors to 400', async () => {
    const serviceMock = {
        getGlobalTopHero: async () => {
            throw new Error('Role and lane query parameters are required');
        },
    };
    const controller = loadController(serviceMock);

    const req = { query: {} };
    const res = makeRes();

    await controller.getGlobalTopHero(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.message, 'Role and lane query parameters are required');
});

test('getGlobalTopHero maps not found errors to 404', async () => {
    const serviceMock = {
        getGlobalTopHero: async () => {
            throw new Error('No hero ranking data found');
        },
    };
    const controller = loadController(serviceMock);

    const req = { query: {} };
    const res = makeRes();

    await controller.getGlobalTopHero(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.payload.message, 'No hero ranking data found');
});

test('getGlobalTopHero maps upstream timeout errors to 504', async () => {
    const serviceMock = {
        getGlobalTopHero: async () => {
            const err = new Error('fetch failed');
            err.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };
            throw err;
        },
    };
    const controller = loadController(serviceMock);

    const req = { query: {} };
    const res = makeRes();

    await controller.getGlobalTopHero(req, res);

    assert.equal(res.statusCode, 504);
    assert.equal(res.payload.message, 'Upstream timed out');
});

test('getGlobalTopHero maps unknown errors to 500', async () => {
    const serviceMock = {
        getGlobalTopHero: async () => {
            throw new Error('Unexpected upstream shape');
        },
    };
    const controller = loadController(serviceMock);

    const req = { query: {} };
    const res = makeRes();

    await controller.getGlobalTopHero(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.payload.message, 'Failed to fetch Global Top Hero');
});
