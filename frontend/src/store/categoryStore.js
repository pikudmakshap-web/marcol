import { create } from 'zustand';
import { getCategories } from '../services/categoryService';

export const useCategoryStore = create((set, get) => ({
    categories: [],
    loading: false,
    error: null,
    isLoaded: false,
    fetchCategories: async (force = false) => {
        if (get().isLoaded && !force) return;
        if (get().loading && !force) return;

        set({ loading: true, error: null });

        try {
            const data = await getCategories();
            set({ categories: data, loading: false, isLoaded: true });
        } catch (error) {
            set({ error: error.response?.data?.error || 'Failed to open categories', loading: false });
        }
    },
    resetCategories: () => set({ categories: [], loading: false, error: null, isLoaded: false })
}));
