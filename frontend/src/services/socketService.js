import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

export const socket = io(URL, {
    withCredentials: true,
    autoConnect: false // We'll connect manually when the user logs in
});

// Helper for generic data update listener
export const onDataUpdate = (callback) => {
    socket.on('data_update', callback);
    return () => socket.off('data_update', callback);
};
