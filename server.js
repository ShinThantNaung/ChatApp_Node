const express = require('express');
require('dotenv').config();
const { initSocket } = require('./src/sockets');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./src/routes');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

const parseAllowedOrigins = (rawOrigins) => {
    if (!rawOrigins) {
        return [];
    }
    return rawOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};

const requiredEnvNames = ['JWT_SECRET', 'DATABASE_URL', 'RESEND_API_KEY'];
const missingRequiredEnv = requiredEnvNames.filter((name) => !process.env[name]);
if (missingRequiredEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequiredEnv.join(', ')}`);
}

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || '');
if (isProduction && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must be configured in production');
}

const corsOptions = {
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

        return callback(new Error('CORS origin not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
};

app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('Server is running!');
});

initSocket(server, { allowedOrigins, isProduction });
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

