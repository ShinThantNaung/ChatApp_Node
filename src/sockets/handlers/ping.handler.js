const prisma = require('../../config/prisma');
const { logAuditEvent } = require('../../utils/audit.logger');

module.exports = ( io, socket) => {
    socket.on('join_ping', async(pingId) => {
        try{
            const normalizedPingId = typeof pingId === 'string' ? pingId.trim() : '';

            if(!normalizedPingId) {
                socket.emit('error', 'Ping ID is required');
                return;
            }

            if (!socket.user?.id) {
                logAuditEvent('socket.ping.join.denied', {
                    reason: 'missing_user_context',
                });
                socket.emit('error', 'Authentication error');
                return;
            }

            const ping = await prisma.ping.findUnique({
                where: { id: normalizedPingId },
                select: {
                    id: true,
                    members: {
                        where: { userId: socket.user.id },
                        select: { id: true },
                    },
                },
            });

            if(!ping){
                logAuditEvent('socket.ping.join.denied', {
                    reason: 'ping_not_found',
                    userId: socket.user.id,
                });
                socket.emit('error','Ping does not exist');
                return;
            }

            if (ping.members.length === 0) {
                logAuditEvent('socket.ping.join.denied', {
                    reason: 'not_member',
                    userId: socket.user.id,
                    pingId: normalizedPingId,
                });
                socket.emit('error','Not a squad member');
                return;
            }

            await socket.join(normalizedPingId);
            socket.to(normalizedPingId).emit('ping:joined', {
                userId: socket.user.id
            });
            console.log(`User ${socket.user.id} joined ping ${normalizedPingId}`);
        }catch(err){
            console.error('Failed to join ping room');
            socket.emit('error', 'Failed to join ping');
        }
    });
};