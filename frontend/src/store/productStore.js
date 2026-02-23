import { create } from 'zustand';
import { getProducts } from '../services/productService';

export const useProductStore = create((set, get) => ({
    products: [],
    loading: false,
    error: null,
    isLoaded: false,

    fetchProducts: async (force = false) => {
        if (get().isLoaded && !force) return;
        set({ loading: true, error: null });
        try {
            const data = await getProducts();
            set({ products: data, isLoaded: true, loading: false });
        } catch (error) {
            set({ error: error.message || 'Error fetching products', loading: false });
        }
    },

    addProduct: (product) => set((state) => ({ products: [product, ...state.products] })),
    updateProductState: (id, updatedData) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updatedData } : p)
    })),
    removeProduct: (id) => set((state) => ({ products: state.products.filter(p => p.id !== id) }))
}));
