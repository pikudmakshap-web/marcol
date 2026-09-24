import { useCallback, useEffect, useRef } from 'react';
import { MANUAL_BARCODE_DELAY_MS, resolveManualBarcode } from '../utils/manualBarcode.mjs';

export function useManualBarcodeAdd({ open, query, environmentId, blocked, catalogReady, products, cart, onSelect, onError }) {
    const consumed = useRef(null);
    const latest = useRef(null);
    latest.current = { open, query, environmentId, blocked, catalogReady, products, cart, onSelect, onError };
    const commit = useCallback((explicit = true) => {
        const s = latest.current;
        if (!s.open || s.blocked || !s.environmentId || !s.catalogReady || !s.query) return;
        const token = `${s.environmentId}:${s.query}`;
        if (consumed.current === token) return;
        const product = resolveManualBarcode(s.products, s.query, { explicit });
        if (!product) { if (explicit) s.onError('לא נמצאה התאמה מלאה ויחידה לברקוד.'); return; }
        if (product.environmentId !== s.environmentId) {
            if (explicit) s.onError('נתוני המוצרים אינם תואמים לסביבת העבודה. יש לרענן את הקופה.');
            return;
        }
        consumed.current = token; // Synchronous guard against Enter + pending timer / StrictMode.
        const inCart = s.cart.find(p => p.id === product.id);
        if (!Number.isFinite(product.quantity) || product.quantity <= (Number(inCart?.qty) || 0)) {
            s.onError('אין כמות זמינה נוספת מהמוצר במלאי.'); return;
        }
        s.onSelect(product);
    }, []);
    useEffect(() => {
        consumed.current = null;
        if (!open || blocked || !catalogReady || !environmentId || !query) return;
        const timer = setTimeout(() => commit(false), MANUAL_BARCODE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [open, query, environmentId, blocked, catalogReady, commit]);
    return commit;
}
