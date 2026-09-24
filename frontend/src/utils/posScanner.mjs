// Keyboard-wedge scanner heuristic, NOT device authentication.
// Tune centrally after testing the actual scanner; Enter must end each scan.
export const SCANNER_POLICY = Object.freeze({ minLength: 3, maxLength: 128, maxGapMs: 80, maxAverageGapMs: 40 });
export function createScanCollector(policy = SCANNER_POLICY) {
    let text = '', start = 0, last = 0;
    const reset = () => { text = ''; start = 0; last = 0; };
    return {
        reset,
        push(event, now) {
            if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) { reset(); return null; }
            if (event.key === 'Shift') return null;
            if (event.key === 'Enter') {
                const elapsed = last - start;
                const result = text.length >= policy.minLength && now - last <= policy.maxGapMs && elapsed / Math.max(1, text.length - 1) <= policy.maxAverageGapMs ? text : null;
                reset(); return result;
            }
            if (!/^[!-~]$/.test(event.key)) { reset(); return null; }
            if (!text || now - last > policy.maxGapMs) { text = ''; start = now; }
            if (text.length >= policy.maxLength) { reset(); return null; }
            text += event.key; last = now;
            return null;
        }
    };
}
