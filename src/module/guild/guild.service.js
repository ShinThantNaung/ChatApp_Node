const prisma = require('./guild.config');

const createGuild = async (data, userId) => {
    if (!data) {
        throw new Error('Guild payload is required');
    }
    if(!userId) {
        throw new Error('Authentication required');
    }
    const existingGuild = await prisma.guild.findFirst({
        where: {
            name: data.name,
        },
    });
    if (existingGuild) {
        throw new Error('Guild name already exists');
    }
    const newGuild = await prisma.guild.create({
        data: {
            name: data.name,
            leaderId: userId,
            members: {
                create: {
                    userId,
                    role: 'leader',
                },
            },
        }
    });
    return newGuild;
};
const getGuildById = async (guildId) => {
    if (!guildId) {
        throw new Error('Guild id is required');
    }
    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatarUrl: true,
                        }
                    }
                }
            }
        },
    });
    if (!guild) {
        throw new Error('Guild not found');
    }
    return guild;
};

const joinGuild = async (guildId, userId) => {
    if (!guildId) {
        throw new Error('Guild id is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }
    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
            members: true,
        },
    });
    if (!guild) {
        throw new Error('Guild not found');
    }
    const existingMember = guild.members.find(member => member.userId === userId);
    if (existingMember) {
        throw new Error('Already a member of this guild');
    }
    const newMember = await prisma.guildMember.create({
        data: {
            guildId,
            userId,
            role: 'member',
        },
    });
    return newMember;
};

const leaveGuild = async (guildId, userId) => {
    if (!guildId) {
        throw new Error('Guild id is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }
    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
            members: true,
        },
    });
    if (!guild) {
        throw new Error('Guild not found');
    }
    const member = guild.members.find(m => m.userId === userId);
    if (!member) {
        throw new Error('Not a member of this guild');
    }
    if (member.role === 'leader') {
        throw new Error('Guild leader cannot leave the guild');
    }
    await prisma.guildMember.delete({
        where: { id: member.id },
    });
    return { message: 'Left the guild successfully' };
}

const deleteGuild = async (guildId, userId) => {
    if (!guildId) {
        throw new Error('Guild id is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }
    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
    });
    if (!guild) {
        throw new Error('Guild not found');
    }
    if (guild.leaderId !== userId) {
        throw new Error('Only the guild leader can delete the guild');
    }
    await prisma.guild.delete({
        where: { id: guildId },
    });
    return { message: 'Guild deleted successfully' };
}

module.exports = {
    createGuild,
    getGuildById,
    joinGuild,
    leaveGuild,
    deleteGuild,
};