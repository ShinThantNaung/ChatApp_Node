const prisma = require('../../config/prisma');

module.exports = (io,socket) =>{
    socket.on('send_message', async({pingId, content}) => {
        try{
            if(!pingId || !content){
                socket.emit('error', 'Ping ID and content are required');
                return;
            }
            const member = await prisma.ping.findUnique({
                where: { id: pingId },
                include: { members: true },
            });
            if(!member){
                socket.emit('error','Not a squad member');
                return;
            }
            const newMessage = await prisma.message.create({
                    data: {
                    pingId,
                    senderId: socket.user.id,
                    content: message,
                    type: 'text'
                    },
                    include: {
                    sender: {
                        select: {
                        id: true,
                        username: true,
                        avatarUrl: true
                        }
                    }
                    }
                });
                io.to(pingId).emit('new_message', {
                    message: newMessage
                });
                console.log(`User ${socket.user.id} sent message to ping ${pingId}`);
        }catch(err){
            console.log(err);
            socket.emit('error', 'Failed to send message');
        }
    });
}