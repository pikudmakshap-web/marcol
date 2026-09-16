import { create } from 'zustand';
import { authService } from '../services/authService';

export const useAuthStore = create((set) => ({
    user: authService.getCurrentUser(),
    token: localStorage.getItem('token'),
    isAuthenticated: authService.isAuthenticated(),
    loading: false,
    error: null,

    login: async (username, password) => {
        set({ loading: true, error: null });
        try {
            const data = await authService.login(username, password);
            set({
                user: data.user,
                token: data.token,
                isAuthenticated: true,
                loading: false
            });
            return data;
        } catch (error) {
            set({
                error: error.response?.data?.error || 'Login failed',
                loading: false
            });
            throw error;
        }
    },

    devSwitch: async (userId) => {
        set({ loading: true, error: null });
        try {
            const data = await authService.devSwitch(userId);
            set({
                user: data.user,
                token: data.token,
                isAuthenticated: true,
                loading: false
            });
            return data;
        } catch (error) {
            set({
                error: error.response?.data?.error || 'Switch failed',
                loading: false
            });
            throw error;
        }
    },

    logout: async () => {
        await authService.logout();
        set({
            user: null,
            token: null,
            isAuthenticated: false
        });
    },

    switchEnvironment: async (environmentId) => {
        set({ loading: true, error: null });
        try {
            const data = await authService.switchEnvironment(environmentId);
            set({
                user: data.user,
                token: data.token || localStorage.getItem('token'),
                loading: false
            });
            return data;
        } catch (error) {
            set({
                error: error.response?.data?.error || 'Switching environment failed',
                loading: false
            });
            throw error;
        }
    },

    refreshUser: async () => {
        try {
            const userData = await authService.getMe();
            set({ user: userData });
            localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    },

    clearError: () => set({ error: null })
}));
