import api from './api';

// Wallets
export const getWallets = async (params) => {
    const response = await api.get('/wallets', { params });
    return response.data;
};

export const getWallet = async (id) => {
    const response = await api.get(`/wallets/${id}`);
    return response.data;
};

export const createWallet = async (walletData) => {
    const response = await api.post('/wallets', walletData);
    return response.data;
};

export const updateWallet = async (id, walletData) => {
    const response = await api.put(`/wallets/${id}`, walletData);
    return response.data;
};

export const deleteWallet = async (id) => {
    const response = await api.delete(`/wallets/${id}`);
    return response.data;
};

export const creditWallet = async (id, amount, options = {}) => {
    const response = await api.post(`/wallets/${id}/credit`, { ...options, amount }, { timeout: 20000 });
    return response.data;
};

export const debitWallet = async (id, amount) => {
    const response = await api.post(`/wallets/${id}/debit`, { amount });
    return response.data;
};

export const getWalletTransactions = async (id) => {
    const response = await api.get(`/wallets/${id}/transactions`);
    return response.data;
};

export const searchWallets = async (query) => {
    const normalizedQuery = String(query ?? '').trim();
    if (!normalizedQuery) {
        return [];
    }

    const response = await api.get('/wallets/search', {
        params: { q: normalizedQuery }
    });

    return Array.isArray(response.data) ? response.data : [];
};
