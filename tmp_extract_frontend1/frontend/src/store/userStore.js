import { create } from 'zustand';
import { getUsers } from '../services/userService';

export const useUserStore = create((set, get) => ({
    users: [],
    loading: false,
    error: null,
    isLoaded: false,

    fetchUsers: async (force = false) => {
        if (get().isLoaded && !force) return;
        set({ loading: true, error: null });
        try {
            const data = await getUsers();
            set({ users: data, isLoaded: true, loading: false });
        } catch (error) {
            set({ error: error.message || 'Error fetching users', loading: false });
        }
    },

    addUser: (user) => set((state) => ({ users: [user, ...state.users] })),
    updateUserState: (id, updatedData) => set((state) => ({
        users: state.users.map(u => u.id === id ? { ...u, ...updatedData } : u)
    })),
    removeUser: (id) => set((state) => ({ users: state.users.filter(u => u.id !== id) }))
}));
