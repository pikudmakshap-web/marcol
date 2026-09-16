import { create } from 'zustand';
import { getDashboardStats } from '../services/dashboardService';

export const useDashboardStore = create((set, get) => ({
    dashboardData: {
        budget: { total: 0, current: 0 },
        inventoryValue: 0,
        sales: { today: 0, goal: 5000 },
        wallets: { count: 0, totalBalance: 0 },
        topProducts: [],
        walletUsage: [],
        lowStockProducts: [],
        walletCategoryStats: [],
        lowestStockProducts: [],
        systemMode: 'none'
    },
    loading: false,
    hasFetchedInit: false,

    fetchDashboardStats: async (force = false) => {
        // Only fetch if forced (e.g., socket update or manual pull), or if it's the first time
        if (!force && get().hasFetchedInit) return;

        // Only show loading state on the very first fetch
        if (!get().hasFetchedInit) {
            set({ loading: true });
        }

        try {
            const data = await getDashboardStats();
            set({ dashboardData: data, hasFetchedInit: true, loading: false });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            set({ loading: false });
        }
    },
}));
