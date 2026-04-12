const pingService = require('./ping.service');

const getStatusCode = (message) => {
    switch (message) {
        case 'Ping name is required':
            return 422;
        case 'Ping already exists':
            return 409;
        case 'Ping does not exist':
            return 404;
        case 'Authentication required':
            return 401;
        case 'Ping payload is required':
        case 'Ping id is required':
        case 'At least one role is required':
            return 422;
        case 'Already joined this ping':
        case 'Ping is full':
        case 'No available roles':
            return 409;
        case 'Not a member of this ping':
            return 404;
        default:
            return 500;
    }
};

const createPing = async (req, res) => {
    try {
        const result = await pingService.createPing(req.user?.id, req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};

const joinPing = async (req, res) => {
    try {
        const { pingId } = req.body;
        const result = await pingService.joinPing(pingId, req.user?.id);
        res.status(200).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};

const getActivePing = async (req, res) => {
    try {
        const result = await pingService.getActivePing();
        res.status(200).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};

const leavePing = async (req, res) => {
    try {
        const { pingId } = req.body;
        const result = await pingService.leavePing(pingId, req.user?.id);
        res.status(200).json(result);
    } catch (err) {
        res.status(getStatusCode(err.message)).json({ message: err.message });
    }
};
module.exports = { createPing, joinPing, getActivePing, leavePing };