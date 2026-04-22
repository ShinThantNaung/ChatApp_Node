const prisma = require('../config/auth.config');
const { verifyToken } = require('../utils/auth.utils');
const { logAuditEvent } = require('../../../utils/audit.logger');

const extractBearerToken = (authHeader) => {
    if (typeof authHeader !== 'string') {
        return null;
    }

    const trimmed = authHeader.trim();
    const matches = /^Bearer\s+(.+)$/i.exec(trimmed);
    if (!matches || !matches[1]) {
        return null;
    }

    return matches[1].trim();
};

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = extractBearerToken(authHeader);

        if (!token) {
            logAuditEvent('auth.http.denied', {
                reason: 'missing_or_malformed_bearer',
                ip: req.ip,
                path: req.originalUrl,
                method: req.method,
            });
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = verifyToken(token);
        const user = await prisma.user.findUnique({
            where: {
                id: decoded.id,
            },
            select: {
                id: true,
                username: true,
                email: true,
            },
        });

        if (!user) {
            logAuditEvent('auth.http.denied', {
                reason: 'user_not_found',
                ip: req.ip,
                path: req.originalUrl,
                method: req.method,
            });
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        return next();
    } catch (err) {
        logAuditEvent('auth.http.denied', {
            reason: 'invalid_token',
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
        });
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = { authenticate };