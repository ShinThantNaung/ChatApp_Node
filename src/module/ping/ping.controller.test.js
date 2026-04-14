const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, './ping.controller.js');
const servicePath = path.resolve(__dirname, './ping.service.js');
const socketsPath = path.resolve(__dirname, '../../sockets/index.js');

const makeRes = () => {
    return {
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
    };
};

const loadController = ({ serviceMock, ioMock, socketsThrows = false }) => {
    delete require.cache[controllerPath];
    require.cache[servicePath] = {
        id: servicePath,
        filename: servicePath,
        loaded: true,
        exports: serviceMock,
    };
    require.cache[socketsPath] = {
        id: socketsPath,
        filename: socketsPath,
        loaded: true,
        exports: {
            getIo: () => {
                if (socketsThrows) {
                    throw new Error('Socket.io not initialized');
                }
                return ioMock;
            },
        },
    };

    return require(controllerPath);
};

test('createPing returns 201 and emits ping:created', async () => {
    const emits = [];
    const serviceMock = {
        createPing: async (data, userId) => ({ id: 'ping-1', title: data.title, creatorId: userId }),
    };
    const controller = loadController({
        serviceMock,
        ioMock: {
            emit: (...args) => emits.push(args),
        },
    });

    const req = {
        body: { title: 'Solo Queue' },
        user: { id: 'user-1' },
    };
    const res = makeRes();

    await controller.createPing(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.id, 'ping-1');
    assert.equal(emits.length, 1);
    assert.equal(emits[0][0], 'ping:created');
    assert.equal(emits[0][1].actorId, 'user-1');
});

test('joinPing maps domain error to 409', async () => {
    const serviceMock = {
        joinPing: async () => {
            throw new Error('Already joined this ping');
        },
    };
    const controller = loadController({
        serviceMock,
        ioMock: { emit: () => {} },
    });

    const req = {
        body: { pingId: 'ping-1' },
        user: { id: 'user-1' },
    };
    const res = makeRes();

    await controller.joinPing(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.payload.message, 'Already joined this ping');
});

test('leavePing still returns success when socket is unavailable', async () => {
    const serviceMock = {
        leavePing: async () => ({ message: 'Left ping successfully' }),
    };
    const controller = loadController({
        serviceMock,
        ioMock: { emit: () => {} },
        socketsThrows: true,
    });

    const req = {
        body: { pingId: 'ping-1' },
        user: { id: 'user-9' },
    };
    const res = makeRes();

    await controller.leavePing(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.message, 'Left ping successfully');
});

test('deletePing returns 200 and emits ping:deleted', async () => {
    const emits = [];
    const serviceMock = {
        deletePing: async () => ({ message: 'Ping deleted successfully' }),
    };
    const controller = loadController({
        serviceMock,
        ioMock: {
            emit: (...args) => emits.push(args),
        },
    });

    const req = {
        body: { pingId: 'ping-1' },
        user: { id: 'user-1' },
    };
    const res = makeRes();

    await controller.deletePing(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.message, 'Ping deleted successfully');
    assert.equal(emits.length, 1);
    assert.equal(emits[0][0], 'ping:deleted');
    assert.equal(emits[0][1].pingId, 'ping-1');
    assert.equal(emits[0][1].actorId, 'user-1');
});
