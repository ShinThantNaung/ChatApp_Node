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

    const normalizedRoles = roles.map((r) => {
        if (typeof r === 'string') {
            return {
                roleId: '',
                roleName: r.trim(),
                slots: 1,
            };
        }

        const roleNameValue =
            typeof r?.role === 'string'
                ? r.role
                : typeof r?.roleName === 'string'
                    ? r.roleName
                    : typeof r?.name === 'string'
                        ? r.name
                        : '';

        return {
            roleId: typeof r?.roleId === 'string' ? r.roleId.trim() : '',
            roleName: roleNameValue.trim(),
            slots: Number(r?.slots),
        };
    });

    const hasInvalidRolePayload = normalizedRoles.some((r) => (!r.roleId && !r.roleName) || !Number.isInteger(r.slots) || r.slots <= 0);
    if (hasInvalidRolePayload) {
        throw new Error('Each role must include roleId or role name, and slots > 0');
    }

    const uniqueRoleIds = [...new Set(normalizedRoles.map((r) => r.roleId).filter(Boolean))];
    const uniqueRoleNames = [...new Set(normalizedRoles.map((r) => r.roleName).filter(Boolean))];

    const whereOr = [];
    if (uniqueRoleIds.length > 0) {
        whereOr.push({ id: { in: uniqueRoleIds } });
    }
    if (uniqueRoleNames.length > 0) {
        whereOr.push({ name: { in: uniqueRoleNames } });
    }

    const existingRoles = await prisma.role.findMany({
        where: { OR: whereOr },
        select: { id: true, name: true },
    });

    const roleById = new Map(existingRoles.map((r) => [r.id, r.id]));
    const roleByName = new Map(existingRoles.map((r) => [r.name.toLowerCase(), r.id]));

    const resolvedRoles = normalizedRoles.map((r) => {
        if (r.roleId) {
            return {
                roleId: roleById.get(r.roleId),
                slots: r.slots,
            };
        }

        return {
            roleId: roleByName.get(r.roleName.toLowerCase()),
            slots: r.slots,
        };
    });

    if (resolvedRoles.some((r) => !r.roleId)) {
        throw new Error('One or more roles are invalid');
    }

    const existingPing = await prisma.ping.findFirst({ where: { title } });
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
                create: resolvedRoles.map((r) => ({
                    roleId: r.roleId,
                    slots: r.slots,
                })),
            },

            members: {
                create: {
                    userId,
                    roleId: resolvedRoles[0].roleId,
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
    if (!pingId) {
        throw new Error('Ping id is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }

    try {
        const member = await prisma.pingMember.findFirst({
            where: {
                pingId,
                userId,
            },
            select: { id: true },
        });

        if (!member) {
            throw new Error('Not a member of this ping');
        }

        await prisma.pingMember.delete({ where: { id: member.id } });
        return { message: 'Left ping successfully' };
    } catch (err) {
        if (err.message === 'Not a member of this ping') {
            throw err;
        }
        throw new Error('Failed to leave ping');
    }
};

module.exports = { createPing, joinPing, getActivePing, leavePing };