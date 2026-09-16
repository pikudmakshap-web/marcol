import api from './api';

export const authService = {
    // התחברות
    login: async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    },

    // התנתקות
    logout: async () => {
        try {
            await api.post('/auth/logout');
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    },

    // קבלת פרטי משתמש מחובר
    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    // --- DEV ONLY ---
    getDevUsers: async () => {
        const response = await api.get('/auth/dev-users');
        return response.data;
    },

    devSwitch: async (userId) => {
        const response = await api.post('/auth/dev-switch', { userId });
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    },
    // --- END DEV ONLY ---

    // בדיקה אם יש טוקן
    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    // קבלת משתמש מ-localStorage
    getCurrentUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
};
