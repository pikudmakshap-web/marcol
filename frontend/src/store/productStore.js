import { create } from 'zustand';
import { getProducts } from '../services/productService';

const DEFAULT_LIMIT = 100;

const normalizeFetchArgs = (forceOrOptions, maybeOptions) => {
    if (typeof forceOrOptions === 'boolean') {
        return { ...(maybeOptions || {}), force: forceOrOptions };
    }
    return forceOrOptions || {};
};

export const useProductStore = create((set, get) => ({
    products: [],
    loading: false,
    loadingMore: false,
    error: null,
    isLoaded: false,
    page: 0,
    hasMore: true,
    limit: DEFAULT_LIMIT,
    total: 0,

    fetchProducts: async (forceOrOptions = false, maybeOptions = {}) => {
        const options = normalizeFetchArgs(forceOrOptions, maybeOptions);
        const force = !!options.force;
        const append = !!options.append;
        const isLoaded = get().isLoaded;
        const reset = !append && (!!options.reset || force || !isLoaded);
        const all = !!options.all;
        const limit = options.limit || get().limit || DEFAULT_LIMIT;
        const { loading, loadingMore } = get();

        if ((reset || all) && loading && !force) return;
        if (append && loadingMore) return;

        if (!reset && !append) return;
        if (append && !get().hasMore) return;

        const nextPage = options.page || (append ? get().page + 1 : 1);

        set({
            ...(reset ? { loading: true } : { loadingMore: true }),
            error: null
        });

        try {
            if (all) {
                const data = await getProducts();
                set({
                    products: Array.isArray(data) ? data : [],
                    isLoaded: true,
                    loading: false,
                    loadingMore: false,
                    page: 1,
                    hasMore: false,
                    limit,
                    total: Array.isArray(data) ? data.length : 0
                });
                return;
            }

            const response = await getProducts({
                paginated: true,
                page: nextPage,
                limit
            });

            const items = Array.isArray(response?.items)
                ? response.items
                : (Array.isArray(response) ? response : []);
            const hasMore = response?.meta ? !!response.meta.hasMore : false;
            const total = response?.meta?.total ?? (reset ? items.length : get().total);

            set((state) => ({
                products: reset ? items : [...state.products, ...items],
                isLoaded: true,
                loading: false,
                loadingMore: false,
                page: nextPage,
                hasMore,
                limit,
                total
            }));
        } catch (error) {
            set({
                error: error.message || 'Error fetching products',
                loading: false,
                loadingMore: false
            });
        }
    },

    loadMoreProducts: async () => {
        const { loading, loadingMore, hasMore } = get();
        if (loading || loadingMore || !hasMore) return;
        await get().fetchProducts({ append: true });
    },

    addProduct: (product) => set((state) => ({ products: [product, ...state.products] })),
    updateProductState: (id, updatedData) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updatedData } : p)
    })),
    removeProduct: (id) => set((state) => ({ products: state.products.filter(p => p.id !== id) })),
    resetProducts: () => set({
        products: [],
        loading: false,
        loadingMore: false,
        error: null,
        isLoaded: false,
        page: 0,
        hasMore: true,
        limit: DEFAULT_LIMIT,
        total: 0
    })
}));
