const prisma = require('./ping.config');

const createPing = async (data, userId) => {
    if (!data) {
        throw new Error('Ping payload is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }

    const { title, gameMode, urgency = false, maxPlayers, status = 'open', roles = [] } = data;
    if (!title || title.trim() === '') {
        throw new Error('Ping name is required');
    }
    if (!Array.isArray(roles) || roles.length === 0) {
        throw new Error('At least one role is required');
    }

    const existingPing = await prisma.ping.findUnique({ where: { title } });
    if (existingPing) {
        throw new Error('Ping already exists');
    }

    const newPing = await prisma.ping.create({ 
        data: {
            title: title.trim(),
            gameMode,
            urgency,
            maxPlayers,
            status,
            creatorId: userId,

            roles: {
                create: roles.map((r) => ({
                    roleId: r.roleId,
                    slots: r.slots,
                })),
            },

            members: {
                create: {
                    userId,
                    roleId: roles[0].roleId,
                    status: 'joined',
                },
            },
        },
        include: {
            roles: true,
            members: true,
        },
    });
    return newPing;
};

const joinPing = async (pingId, userId) => {
    if (!pingId) {
        throw new Error('Ping id is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }

    const ping = await prisma.ping.findUnique({ where: { id: pingId }, include: { members: true, roles: true } });
    if (!ping) {
        throw new Error('Ping does not exist');
    }
    const isMember = ping.members.some(m => m.userId === userId);
    if (isMember) {
        throw new Error('Already joined this ping');
    }
    if (ping.members.length >= ping.maxPlayers) {
        throw new Error('Ping is full');
    }

    const role = ping.roles.find((r) => {
        const currentRoleCount = ping.members.filter((m) => m.roleId === r.roleId).length;
        return currentRoleCount < r.slots;
    });

    if (!role) {
        throw new Error('No available roles');
    }

    const member = await prisma.pingMember.create({
        data: {
            userId,
            pingId,
            roleId: role.roleId,
            status: 'joined',
        },
    });
    return member;
};

const getActivePing = async () => {
    const activePing = await prisma.ping.findMany({
        where: {
            status: 'open',
        },
        include: {
            members: true,
            roles: true,
            creator: {
                select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                }
            }
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    return activePing;
};

const leavePing = async (pingId, userId) => {
    const member = await prisma.pingMember.findUnique({ where: { pingId_userId: { pingId, userId } } });
    if (!member) {
        throw new Error('Not a member of this ping');
    }
    await prisma.pingMember.delete({ where: { id: member.id } });
    return { message: 'Left ping successfully' };
};

module.exports = { createPing, joinPing, getActivePing, leavePing };