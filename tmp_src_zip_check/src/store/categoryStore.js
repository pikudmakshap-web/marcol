import { create } from 'zustand';
import { getCategories } from '../services/categoryService';

export const useCategoryStore = create((set) => ({
    categories: [],
    loading: false,
    error: null,
    fetchCategories: async (force = false) => {
        set((state) => {
            if (state.categories.length > 0 && !force) return state;
            return { loading: true, error: null };
        });
        
        try {
            const data = await getCategories();
            set({ categories: data, loading: false });
        } catch (error) {
            set({ error: error.response?.data?.error || 'Failed to open categories', loading: false });
        }
    }
}));
