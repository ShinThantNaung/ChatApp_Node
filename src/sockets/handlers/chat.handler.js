const prisma = require('../../config/prisma');
const { toGuildRoom } = require('./guild.handler');
const MAX_CHAT_MESSAGE_LENGTH = 500;

module.exports = (io, socket) => {
    const sendGuildMessage = async ({ guildId, content } = {}) => {
        try {
            const normalizedGuildId = typeof guildId === 'string' ? guildId.trim() : '';
            const normalizedContent = typeof content === 'string' ? content.trim() : '';

            if (!normalizedGuildId || !normalizedContent) {
                socket.emit('error', 'Guild ID and content are required');
                return;
            }

            if (normalizedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
                socket.emit('error', `Message is too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)`);
                return;
            }

            const membership = await prisma.guildMember.findUnique({
                where: {
                    userId_guildId: {
                        userId: socket.user.id,
                        guildId: normalizedGuildId,
                    },
                },
                select: { id: true },
            });

            if (!membership) {
                socket.emit('error', 'You must join this guild before chatting');
                return;
            }

            const roomName = toGuildRoom(normalizedGuildId);
            await socket.join(roomName);

            const messagePayload = {
                guildId: normalizedGuildId,
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

            console.log(`User ${socket.user.id} sent message to guild ${normalizedGuildId}`);
        } catch (err) {
            console.error('Failed to send guild message');
            socket.emit('error', 'Failed to send message');
        }
    };

    socket.on('send_message', sendGuildMessage);
    socket.on('guild:send_message', sendGuildMessage);
};