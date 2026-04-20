const pingService = require('./ping.service');
const { getIo } = require('../../sockets');

const emitPingEvent = (eventName, payload) => {
    try {
        const io = getIo();
        io.emit(eventName, payload);
    } catch (err) {
        // Avoid breaking HTTP flow when socket server is not initialized.
    }
};

const getStatusCode = (message) => {
    switch (message) {
        case 'Ping name is required':
        case 'Ping name must be at least 3 characters':
            return 422;
        case 'Ping already exists':
            return 409;
        case 'Ping does not exist':
            return 404;
        case 'Authentication required':
            return 401;
        case 'Only the creator can delete this ping':
            return 403;
        case 'Ping payload is required':
        case 'Ping id is required':
        case 'At least one role is required':
        case 'Each role must include roleId or role name, and slots > 0':
        case 'One or more roles are invalid':
        case 'Creator role must be one of the ping roles':
            return 422;
        case 'Already joined this ping':
        case 'User is already in another ping':
        case 'Ping is full':
        case 'No available roles':
            return 409;
        case 'Not a member of this ping':
            return 404;
        case 'Failed to leave ping':
        case 'Failed to delete ping':
            return 500;
        default:
            return 500;
    }
};

const sendError = (res, err) => {
    const statusCode = getStatusCode(err.message);
    const message = statusCode === 500 ? 'Internal server error' : err.message;
    return res.status(statusCode).json({ message });
};

const createPing = async (req, res) => {
    try {
        const result = await pingService.createPing(req.body, req.user?.id);
        emitPingEvent('ping:created', {
            ping: result,
            actorId: req.user?.id,
        });
        res.status(201).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const joinPing = async (req, res) => {
    try {
        const { pingId } = req.body;
        const result = await pingService.joinPing(pingId, req.user?.id);
        emitPingEvent('ping:joined', {
            pingId,
            member: result,
            actorId: req.user?.id,
        });
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const getActivePing = async (req, res) => {
    try {
        const result = await pingService.getActivePing();
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const leavePing = async (req, res) => {
    try {
        const { pingId } = req.body;
        const result = await pingService.leavePing(pingId, req.user?.id);
        emitPingEvent('ping:left', {
            pingId,
            actorId: req.user?.id,
        });
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const deletePing = async (req, res) => {
    try {
        const { pingId } = req.body;
        const result = await pingService.deletePing(pingId, req.user?.id);
        emitPingEvent('ping:deleted', {
            pingId,
            actorId: req.user?.id,
        });
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

module.exports = { createPing, joinPing, getActivePing, leavePing, deletePing };