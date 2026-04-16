const prisma = require('../../config/prisma');

const GUILD_ROOM_PREFIX = 'guild:';
const USER_ROOM_PREFIX = 'user:';

const toGuildRoom = (guildId) => `${GUILD_ROOM_PREFIX}${guildId}`;
const toUserRoom = (userId) => `${USER_ROOM_PREFIX}${userId}`;

const getGuildIdsForUser = async (userId) => {
    if (!userId) {
        return [];
    }

    const memberships = await prisma.guildMember.findMany({
        where: { userId },
        select: { guildId: true },
    });

    return memberships.map((membership) => membership.guildId);
};

const syncGuildRoomsForSocket = async (socket) => {
    const userId = socket.user?.id || socket.data?.user?.id;
    if (!userId) {
        throw new Error('Authentication required');
    }

    const guildIds = await getGuildIdsForUser(userId);
    const desiredRooms = new Set(guildIds.map(toGuildRoom));
    const currentGuildRooms = [...socket.rooms].filter((room) => room.startsWith(GUILD_ROOM_PREFIX));

    await Promise.all(
        currentGuildRooms
            .filter((room) => !desiredRooms.has(room))
            .map((room) => socket.leave(room))
    );

    await Promise.all(guildIds.map((guildId) => socket.join(toGuildRoom(guildId))));

    socket.data.guildIds = guildIds;
    socket.emit('guild:rooms_synced', { guildIds });

    return guildIds;
};

module.exports = (io, socket) => {
    const userId = socket.user?.id || socket.data?.user?.id;
    if (!userId) {
        socket.emit('error', 'Authentication error');
        return;
    }

    socket.join(toUserRoom(userId));

    syncGuildRoomsForSocket(socket).catch((err) => {
        console.error('Failed to sync guild rooms:', err);
        socket.emit('error', 'Failed to sync guild rooms');
    });

    socket.on('guild:refresh_rooms', async () => {
        try {
            await syncGuildRoomsForSocket(socket);
        } catch (err) {
            console.error('Failed to refresh guild rooms:', err);
            socket.emit('error', 'Failed to refresh guild rooms');
        }
    });
};

module.exports.toGuildRoom = toGuildRoom;
module.exports.toUserRoom = toUserRoom;
module.exports.syncGuildRoomsForSocket = syncGuildRoomsForSocket;
