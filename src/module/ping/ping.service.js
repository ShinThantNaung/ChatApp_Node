const prisma = require('./ping.config');
const { validatePingName } = require('./ping.validator');

const MAX_JOIN_RETRIES = 2;
const MIN_PING_PLAYERS = 2;
const MAX_PING_PLAYERS = 10;
const VALID_PING_STATUSES = new Set(['open', 'closed']);

const isRetryableJoinConflict = (err) => err?.code === 'P2034';

const hasAvailableRoleSlot = (roles, members) => {
    return roles.some((r) => {
        const currentRoleCount = members.filter((m) => m.roleId === r.roleId).length;
        return currentRoleCount < r.slots;
    });
};

const getNextPingStatus = (ping, members) => {
    const isMaxPlayersReached = members.length >= ping.maxPlayers;
    const areRoleSlotsFull = !hasAvailableRoleSlot(ping.roles, members);

    return isMaxPlayersReached || areRoleSlotsFull ? 'closed' : 'open';
};

const createPing = async (data, userId) => {
    if (!data) {
        throw new Error('Ping payload is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }

    const {
        title,
        gameMode,
        urgency = false,
        maxPlayers,
        status = 'open',
        roles = [],
        creatorRoleId,
        creatorRoleName,
    } = data;
    const normalizedTitle = validatePingName(title);
    const parsedMaxPlayers = Number(maxPlayers);
    if (!Number.isInteger(parsedMaxPlayers) || parsedMaxPlayers < MIN_PING_PLAYERS || parsedMaxPlayers > MAX_PING_PLAYERS) {
        throw new Error(`Max players must be an integer between ${MIN_PING_PLAYERS} and ${MAX_PING_PLAYERS}`);
    }

    const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : 'open';
    if (!VALID_PING_STATUSES.has(normalizedStatus)) {
        throw new Error('Ping status must be open or closed');
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

    const availableRoleIds = new Set(resolvedRoles.map((r) => r.roleId));
    const normalizedCreatorRoleId = typeof creatorRoleId === 'string' ? creatorRoleId.trim() : '';
    const normalizedCreatorRoleName = typeof creatorRoleName === 'string' ? creatorRoleName.trim().toLowerCase() : '';

    let selectedCreatorRoleId = resolvedRoles[0].roleId;
    if (normalizedCreatorRoleId) {
        if (!availableRoleIds.has(normalizedCreatorRoleId)) {
            throw new Error('Creator role must be one of the ping roles');
        }
        selectedCreatorRoleId = normalizedCreatorRoleId;
    } else if (normalizedCreatorRoleName) {
        const mappedRoleId = roleByName.get(normalizedCreatorRoleName);
        if (!mappedRoleId || !availableRoleIds.has(mappedRoleId)) {
            throw new Error('Creator role must be one of the ping roles');
        }
        selectedCreatorRoleId = mappedRoleId;
    }

    const existingPing = await prisma.ping.findFirst({ where: { title: normalizedTitle } });
    if (existingPing) {
        throw new Error('Ping already exists');
    }

    const existingMembership = await prisma.pingMember.findFirst({
        where: { userId },
        select: { pingId: true },
    });
    if (existingMembership) {
        throw new Error('User is already in another ping');
    }

    const newPing = await prisma.ping.create({ 
        data: {
            title: normalizedTitle,
            gameMode,
            urgency,
            maxPlayers: parsedMaxPlayers,
            status: normalizedStatus,
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
                    roleId: selectedCreatorRoleId,
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

    let lastError;

    for (let attempt = 0; attempt < MAX_JOIN_RETRIES; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                // Lock this ping row so concurrent joins for the same ping are serialized.
                await tx.$queryRaw`SELECT id FROM Ping WHERE id = ${pingId} FOR UPDATE`;

                const ping = await tx.ping.findUnique({
                    where: { id: pingId },
                    include: { members: true, roles: true },
                });

                if (!ping) {
                    throw new Error('Ping does not exist');
                }

                const isMember = ping.members.some((m) => m.userId === userId);
                if (isMember) {
                    throw new Error('Already joined this ping');
                }

                const existingMembership = await tx.pingMember.findFirst({
                    where: {
                        userId,
                        pingId: { not: pingId },
                    },
                    select: { pingId: true },
                });
                if (existingMembership) {
                    throw new Error('User is already in another ping');
                }

                if (ping.members.length >= ping.maxPlayers || !hasAvailableRoleSlot(ping.roles, ping.members)) {
                    if (ping.status !== 'closed') {
                        await tx.ping.update({
                            where: { id: pingId },
                            data: { status: 'closed' },
                        });
                    }

                    if (ping.members.length >= ping.maxPlayers) {
                        throw new Error('Ping is full');
                    }

                    throw new Error('No available roles');
                }

                const role = ping.roles.find((r) => {
                    const currentRoleCount = ping.members.filter((m) => m.roleId === r.roleId).length;
                    return currentRoleCount < r.slots;
                });

                if (!role) {
                    throw new Error('No available roles');
                }

                const member = await tx.pingMember.create({
                    data: {
                        userId,
                        pingId,
                        roleId: role.roleId,
                        status: 'joined',
                    },
                });

                const nextStatus = getNextPingStatus(ping, [...ping.members, { roleId: role.roleId }]);
                if (ping.status !== nextStatus) {
                    await tx.ping.update({
                        where: { id: pingId },
                        data: { status: nextStatus },
                    });
                }

                return member;
            });
        } catch (err) {
            lastError = err;
            if (!isRetryableJoinConflict(err) || attempt === MAX_JOIN_RETRIES - 1) {
                throw err;
            }
        }
    }

    throw lastError;
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
        return await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM Ping WHERE id = ${pingId} FOR UPDATE`;

            const ping = await tx.ping.findUnique({
                where: { id: pingId },
                include: { members: true, roles: true },
            });

            if (!ping) {
                throw new Error('Ping does not exist');
            }

            const member = ping.members.find((m) => m.userId === userId);
            if (!member) {
                throw new Error('Not a member of this ping');
            }

            await tx.pingMember.delete({ where: { id: member.id } });

            const remainingMembers = ping.members.filter((m) => m.id !== member.id);
            const nextStatus = getNextPingStatus(ping, remainingMembers);
            if (ping.status !== nextStatus) {
                await tx.ping.update({
                    where: { id: pingId },
                    data: { status: nextStatus },
                });
            }

            return { message: 'Left ping successfully' };
        });
    } catch (err) {
        if (err.message === 'Not a member of this ping' || err.message === 'Ping does not exist') {
            throw err;
        }
        throw new Error('Failed to leave ping');
    }
};

const deletePing = async (pingId, userId) => {
    if (!pingId) {
        throw new Error('Ping id is required');
    }
    if (!userId) {
        throw new Error('Authentication required');
    }
    try {
        const ping = await prisma.ping.findUnique({ where: { id: pingId } });
        if (!ping) {
            throw new Error('Ping does not exist');
        }
        if (ping.creatorId !== userId) {
            throw new Error('Only the creator can delete this ping');
        }

        await prisma.$transaction([
            prisma.message.deleteMany({ where: { pingId } }),
            prisma.pingMember.deleteMany({ where: { pingId } }),
            prisma.pingRole.deleteMany({ where: { pingId } }),
            prisma.ping.delete({ where: { id: pingId } }),
        ]);

        return { message: 'Ping deleted successfully' };
    } catch (err) {
        if (err.message === 'Ping does not exist' || err.message === 'Only the creator can delete this ping') {
            throw err;
        }
        throw new Error('Failed to delete ping');
    }
};
module.exports = { createPing, joinPing, getActivePing, leavePing, deletePing };