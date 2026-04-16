const prisma = require('../../config/prisma');
const { toGuildRoom } = require('./guild.handler');

module.exports = (io, socket) => {
    const sendGuildMessage = async ({ guildId, content } = {}) => {
        try {
            const normalizedContent = typeof content === 'string' ? content.trim() : '';

            if (!guildId || !normalizedContent) {
                socket.emit('error', 'Guild ID and content are required');
                return;
            }

            const membership = await prisma.guildMember.findUnique({
                where: {
                    userId_guildId: {
                        userId: socket.user.id,
                        guildId,
                    },
                },
                select: { id: true },
            });

            if (!membership) {
                socket.emit('error', 'You must join this guild before chatting');
                return;
            }

            const roomName = toGuildRoom(guildId);
            await socket.join(roomName);

            const messagePayload = {
                guildId,
                content: normalizedContent,
                sender: {
                    id: socket.user.id,
                    username: socket.user.username,
                    avatarUrl: socket.user.avatarUrl || null,
                },
                createdAt: new Date().toISOString(),
            };

            io.to(roomName).emit('new_message', messagePayload);
            io.to(roomName).emit('guild:new_message', messagePayload);

            console.log(`User ${socket.user.id} sent message to guild ${guildId}`);
        } catch (err) {
            console.log(err);
            socket.emit('error', 'Failed to send message');
        }
    };

    socket.on('send_message', sendGuildMessage);
    socket.on('guild:send_message', sendGuildMessage);
};