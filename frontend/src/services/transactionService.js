import api from './api';

export const createTransaction = async (transactionData) => {
    const response = await api.post('/transactions', transactionData);
    return response.data;
};

export const getTransactions = async (params) => {
    const response = await api.get('/transactions', { params });
    return response.data;
};

export const getTransaction = async (id) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
};

export const returnTransaction = async (id) => {
    const response = await api.post(`/transactions/${id}/return`);
    return response.data;
};
