const { Server } = require('socket.io');
const logger = require('./utils/logger.js');
const { usersPrisma } = require('./config/database.js');

let io;
const onlineUsers = new Map();

const getOnlineUsers = () => {
    return Array.from(onlineUsers.keys());
};

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: function (origin, callback) {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);
                if (origin.startsWith('http://localhost:')) {
                    callback(null, true);
                } else if (origin === process.env.FRONTEND_URL) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        logger.info(`🔌 New socket connection: ${socket.id}`);

        const userId = socket.handshake.auth?.userId;
        if (userId) {
            const currentSockets = onlineUsers.get(userId) || new Set();
            currentSockets.add(socket.id);
            onlineUsers.set(userId, currentSockets);

            // Broadcast that the user is online
            io.emit('user_status_change', { userId, isOnline: true });
            logger.info(`👤 User ${userId} is now online (Socket: ${socket.id})`);
        }

        socket.on('disconnect', async () => {
            logger.info(`🔌 Socket disconnected: ${socket.id}`);

            if (userId) {
                const currentSockets = onlineUsers.get(userId);
                if (currentSockets) {
                    currentSockets.delete(socket.id);
                    if (currentSockets.size === 0) {
                        onlineUsers.delete(userId);
                        const lastSeen = new Date();
                        io.emit('user_status_change', { userId, isOnline: false, lastSeen });
                        logger.info(`👤 User ${userId} is now offline`);

                        try {
                            await usersPrisma.user.update({
                                where: { id: userId },
                                data: { lastSeen }
                            });
                        } catch (err) {
                            logger.error(`Error updating lastSeen for user ${userId}: ${err.message}`);
                        }
                    }
                }
            }
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized!');
    }
    return io;
};

module.exports = { getOnlineUsers, initSocket, getIO };
