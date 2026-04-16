const prisma = require('../module/auth/config/auth.config');
const { verifyToken } = require('../module/auth/utils/auth.utils');

const extractTokenFromSocket = (socket) => {
	const authToken = socket.handshake?.auth?.token;
	if (authToken) {
		return authToken.startsWith('Bearer ') ? authToken.split(' ')[1] : authToken;
	}

	const authHeader = socket.handshake?.headers?.authorization;
	if (authHeader) {
		return authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
	}

	return null;
};

const socketAuth = async (socket, next) => {
	try {
		const token = extractTokenFromSocket(socket);
		if (!token) {
			return next(new Error('Authentication error: No token provided'));
		}

		const decoded = verifyToken(token);
		const user = await prisma.user.findUnique({
			where: { id: decoded.id },
			select: { id: true, username: true, email: true, avatarUrl: true },
		});

		if (!user) {
			return next(new Error('Authentication error: User not found'));
		}

		socket.user = user;
		socket.data.user = user;
		next();
	} catch (err) {
		return next(new Error('Authentication error: Invalid token'));
	}
};

module.exports = { socketAuth };
