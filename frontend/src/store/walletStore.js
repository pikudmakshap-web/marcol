import { create } from 'zustand';
import { getWallets } from '../services/walletService';

const DEFAULT_LIMIT = 50;

const normalizeFetchArgs = (forceOrOptions, maybeOptions) => {
    if (typeof forceOrOptions === 'boolean') {
        return { ...(maybeOptions || {}), force: forceOrOptions };
    }
    return forceOrOptions || {};
};

export const useWalletStore = create((set, get) => ({
    wallets: [],
    loading: false,
    loadingMore: false,
    error: null,
    isLoaded: false,
    page: 0,
    hasMore: true,
    limit: DEFAULT_LIMIT,
    total: 0,

    fetchWallets: async (forceOrOptions = false, maybeOptions = {}) => {
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
                const data = await getWallets();
                set({
                    wallets: Array.isArray(data) ? data : [],
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

            const response = await getWallets({
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
                wallets: reset ? items : [...state.wallets, ...items],
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
                error: error.message || 'Error fetching wallets',
                loading: false,
                loadingMore: false
            });
        }
    },

    loadMoreWallets: async () => {
        const { loading, loadingMore, hasMore } = get();
        if (loading || loadingMore || !hasMore) return;
        await get().fetchWallets({ append: true });
    },

    addWallet: (wallet) => set((state) => ({ wallets: [wallet, ...state.wallets] })),
    updateWalletState: (id, updatedData) => set((state) => ({
        wallets: state.wallets.map(w => w.id === id ? { ...w, ...updatedData } : w)
    })),
    removeWallet: (id) => set((state) => ({ wallets: state.wallets.filter(w => w.id !== id) })),
    resetWallets: () => set({
        wallets: [],
        loading: false,
        loadingMore: false,
        error: null,
        isLoaded: false,
        page: 0,
        hasMore: true,
        limit: DEFAULT_LIMIT,
        total: 0
    }),
    
    getSystemMode: () => {
        const wallets = get().wallets;
        if (wallets.length === 0) return 'none';
        const firstWallet = wallets[0];
        const isCategory = Array.isArray(firstWallet.categoryBalances) && firstWallet.categoryBalances.length > 0;
        return isCategory ? 'category' : 'general';
    }
}));
