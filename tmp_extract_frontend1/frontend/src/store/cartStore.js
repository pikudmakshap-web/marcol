import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
    items: [],

    addItem: (product, quantity = 1) => {
        const items = get().items;
        const existingIndex = items.findIndex(item => item.id === product.id);

        if (existingIndex >= 0) {
            // Update quantity
            const newItems = [...items];
            newItems[existingIndex].quantity += quantity;
            set({ items: newItems });
        } else {
            // Add new item
            set({
                items: [...items, {
                    id: product.id,
                    productId: product.id,
                    productName: product.name,
                    unitPrice: product.unitPrice,
                    quantity,
                    barcode: product.barcode,
                    sku: product.sku
                }]
            });
        }
    },

    removeItem: (productId) => {
        set({ items: get().items.filter(item => item.id !== productId) });
    },

    updateQuantity: (productId, quantity) => {
        const items = get().items;
        const index = items.findIndex(item => item.id === productId);

        if (index >= 0) {
            const newItems = [...items];
            if (quantity <= 0) {
                newItems.splice(index, 1);
            } else {
                newItems[index].quantity = quantity;
            }
            set({ items: newItems });
        }
    },

    clearCart: () => {
        set({ items: [] });
    },

    getTotal: () => {
        return get().items.reduce((sum, item) => {
            return sum + (parseFloat(item.unitPrice) * item.quantity);
        }, 0);
    },

    getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
    }
}));
