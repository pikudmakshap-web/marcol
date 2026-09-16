import { create } from 'zustand';
import { getWallets } from '../services/walletService';

export const useWalletStore = create((set, get) => ({
    wallets: [],
    loading: false,
    error: null,
    isLoaded: false,

    fetchWallets: async (force = false) => {
        if (get().isLoaded && !force) return;
        if (!get().isLoaded) {
            set({ loading: true, error: null });
        }
        try {
            const data = await getWallets();
            set({ wallets: data, isLoaded: true, loading: false });
        } catch (error) {
            set({ error: error.message || 'Error fetching wallets', loading: false });
        }
    },

    addWallet: (wallet) => set((state) => ({ wallets: [wallet, ...state.wallets] })),
    updateWalletState: (id, updatedData) => set((state) => ({
        wallets: state.wallets.map(w => w.id === id ? { ...w, ...updatedData } : w)
    })),
    removeWallet: (id) => set((state) => ({ wallets: state.wallets.filter(w => w.id !== id) })),
    
    getSystemMode: () => {
        const wallets = get().wallets;
        if (wallets.length === 0) return 'none';
        const firstWallet = wallets[0];
        const isCategory = Array.isArray(firstWallet.categoryBalances) && firstWallet.categoryBalances.length > 0;
        return isCategory ? 'category' : 'general';
    }
}));
