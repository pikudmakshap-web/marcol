export const MANUAL_BARCODE_DELAY_MS = 500;
export function resolveManualBarcode(products, query, { explicit = false } = {}) {
    if (typeof query !== 'string' || !/^[0-9]{1,128}$/.test(query) || !Array.isArray(products)) return null;
    // Count all exact matches before filtering inactive items; legacy duplicates
    // must not be silently treated as a unique identifier.
    const exact = products.filter(p => p.barcode === query);
    if (exact.length !== 1 || exact[0].isActive === false) return null;
    // Do not consume a shorter barcode while another longer barcode is being typed.
    const candidates = products.filter(p => typeof p.barcode === 'string' && p.barcode.startsWith(query));
    return explicit || candidates.length === 1 ? exact[0] : null;
}
export function filterManualBarcodes(products, query) {
    if (typeof query !== 'string' || !/^[0-9]+$/.test(query)) return [];
    return products.filter(p => p.isActive !== false && typeof p.barcode === 'string' && p.barcode.startsWith(query));
}
