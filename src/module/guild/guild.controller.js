const guildServie = require('./guild.service')

const syncGuildRoomsForUsers = async (userIds = []) => {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) {
        return;
    }

    try {
        const { getIo } = require('../../sockets');
        const { syncGuildRoomsForSocket, toUserRoom } = require('../../sockets/handlers/guild.handler');
        const io = getIo();

        await Promise.all(
            uniqueUserIds.map(async (userId) => {
                const sockets = await io.in(toUserRoom(userId)).fetchSockets();
                await Promise.all(sockets.map((socket) => syncGuildRoomsForSocket(socket)));
            })
        );
    } catch (err) {
        // Socket server can be unavailable during isolated unit tests.
    }
};

const getStatusCode = (message) => {
    switch (message) {
        case 'Guild name already exists':
            return 409;
        case 'Guild not found':
            return 404;
        case 'Already a member of this guild':
            return 409;
        case 'Not a member of this guild':
            return 404;
        case 'Guild leader cannot leave the guild':
            return 409;
        case 'Only the guild leader can delete the guild':
            return 403;
        case 'Guild name is required':
            return 422;
        case 'Guild already exists':
            return 409;
        case 'Guild does not exist':
            return 404;
        case 'Authentication required':
            return 401;
        case 'Only the creator can delete this Guild':
            return 403;
        case 'Guild payload is required':
        case 'Guild id is required':
        case 'At least one role is required':
        case 'Each role must include roleId or role name, and slots > 0':
        case 'One or more roles are invalid':
            return 422;
        case 'Already joined this Guild':
        case 'Guild is full':
        case 'No available roles':
            return 409;
        case 'Not a member of this Guild':
            return 404;
        case 'Failed to leave Guild':
        case 'Failed to delete Guild':
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

const createGuild = async (req, res) => {
    try {
        const result = await guildServie.createGuild(req.body, req.user?.id);
        await syncGuildRoomsForUsers([req.user?.id]);
        res.status(201).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const joinGuild = async (req, res) => {
    try {
        const { guildId } = req.body;
        const result = await guildServie.joinGuild(guildId, req.user?.id);
        await syncGuildRoomsForUsers([req.user?.id]);
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const leaveGuild = async (req, res) => {
    try {
        const { guildId } = req.body;
        await guildServie.leaveGuild(guildId, req.user?.id);
        await syncGuildRoomsForUsers([req.user?.id]);
        res.status(200).json({ message: 'Successfully left the guild' });
    }
    catch (err) {
        sendError(res, err);
    }
};

const getActiveGuild = async (req, res) => {
    try {
        const result = await guildServie.getActiveGuild();
        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

const deleteGuild = async (req, res) => {
    try {
        const { guildId } = req.body;
        const result = await guildServie.deleteGuild(guildId, req.user?.id);
        await syncGuildRoomsForUsers(result.memberIds || [req.user?.id]);
        res.status(200).json({ message: 'Successfully deleted the guild' });
    } catch (err) {
        sendError(res, err);
    }
};

module.exports = {
    createGuild,
    joinGuild,
    getActiveGuild,
    leaveGuild,
    deleteGuild
}