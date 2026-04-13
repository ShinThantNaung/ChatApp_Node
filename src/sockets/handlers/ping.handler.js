const prisma = require('../../config/prisma');

module.exports = ( io, socket) => {
    socket.on('join_ping', async(pingId) => {
        try{
            if(!pingId) {
                socket.emit('error', 'Ping ID is required');
                return;
            }
            const member = await prisma.ping.findUnique({
                where: { id: pingId },
                include: { members: true },
            });
            if(!member){
                socket.emit('error','Not a squad member');
            }
            socket.join(pingId);
            socket.to(pingId).emit('ping:joined', {
                userId: socket.user.id
            });
            console.log(`User ${socket.user.id} joined ping ${pingId}`);
        }catch(err){
            console.log(err);
            socket.emit('error', 'Failed to join ping');
        }
    });
};