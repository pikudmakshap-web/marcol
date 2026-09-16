import api from './api';

export const getActiveMessage = async () => {
    const response = await api.get('/messages/active');
    return response.data;
};

export const getForceActiveMessage = async () => {
    const response = await api.get('/messages/active/force');
    return response.data;
};

export const dismissMessage = async (messageId) => {
    const response = await api.post(`/messages/${messageId}/dismiss`);
    return response.data;
};

export const createMessage = async (messageData) => {
    const response = await api.post('/messages', messageData);
    return response.data;
};
