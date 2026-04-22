let io;
const { socketAuth } = require('./sockets.middleware');
const pingHandler = require('./handlers/ping.handler');
const chatHandler = require('./handlers/chat.handler');
const guildHandler = require('./handlers/guild.handler');

const initSocket = (server, options = {}) => {
    const { allowedOrigins = [], isProduction = process.env.NODE_ENV === 'production' } = options;

    io = require('socket.io')(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) {
                    return callback(null, true);
                }

                if (!isProduction && allowedOrigins.length === 0) {
                    return callback(null, true);
                }

                if (allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }

                return callback(new Error('Socket CORS origin not allowed'));
            },
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            credentials: true,
        },
    });

    io.use(socketAuth);

    io.on('connection', (socket) => {
        console.log('New client connected: ' + socket.id);

        pingHandler(io, socket);
        guildHandler(io, socket);
        chatHandler(io, socket);
    });
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

module.exports = { initSocket, getIo };