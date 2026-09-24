import { useEffect, useRef, useState } from 'react';
import { creditWallet } from '../services/walletService';
import { newRequestId, pendingStorageKey } from '../utils/topUpRequest.mjs';

const money = (value) => Number(value).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function WalletTopUpModal({ wallet, environmentId, actorId, onClose, onSuccess }) {
    const key = pendingStorageKey(environmentId, actorId, wallet.id);
    const [pending, setPending] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
    });
    const [amount, setAmount] = useState(pending?.amount || '');
    const [categoryName, setCategoryName] = useState(pending?.categoryName || (wallet.categoryBalances?.length === 1 ? wallet.categoryBalances[0].categoryName : ''));
    const [notes, setNotes] = useState(pending?.notes || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(pending ? 'נמצאה פעולה שלא התקבל עבורה אישור. יש לבדוק שוב את אותה פעולה לפני הוספה נוספת.' : '');
    const busyRef = useRef(false);
    const dialogRef = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const previous = document.activeElement;
        const dialog = dialogRef.current;
        const first = dialog?.querySelector('input:not([disabled]),button:not([disabled])');
        first?.focus();
        const handleKey = (event) => {
            if (event.key === 'Escape' && !busyRef.current) closeRef.current();
            if (event.key !== 'Tab') return;
            const controls = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];
            if (!controls.length) return;
            const firstControl = controls[0], lastControl = controls.at(-1);
            if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl.focus(); }
            else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl.focus(); }
        };
        dialog?.addEventListener('keydown', handleKey);
        return () => { dialog?.removeEventListener('keydown', handleKey); previous?.focus?.(); };
    }, []);
    const submit = async (event) => {
        event.preventDefault();
        if (busyRef.current) return;
        if (!pending && (!/^\d{1,9}(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0)) {
            setError('יש להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה'); return;
        }
        if (!pending && wallet.categoryBalances?.length && !categoryName) { setError('יש לבחור קטגוריה'); return; }
        let request = pending;
        try {
            request ||= { amount: amount.trim(), categoryName, notes: notes.trim(), environmentId, requestId: newRequestId() };
            // Persist BEFORE sending. A retry or reopening this dialog reuses the same operation.
            sessionStorage.setItem(key, JSON.stringify(request));
        } catch {
            setError('לא ניתן לשמור מזהה פעולה בדפדפן. לא נשלחה בקשה כדי למנוע הפקדה כפולה.'); return;
        }
        setPending(request); busyRef.current = true; setBusy(true); setError('');
        try {
            const result = await creditWallet(wallet.id, request.amount, request);
            try { sessionStorage.removeItem(key); } catch { /* Replaying the same request remains safe. */ }
            onSuccess(result);
        } catch (failure) {
            const status = failure.response?.status;
            // Timeouts / disconnects / 5xx leave the request immutable for a safe retry.
            if (status && status >= 400 && status < 500 && ![401, 403, 408, 409, 429].includes(status)) {
                try { sessionStorage.removeItem(key); } catch { /* Keep duplicate protection. */ }
                setPending(null);
            }
            setError(failure.response?.data?.error || 'לא התקבל אישור מהשרת. נסה שוב עם אותו מזהה פעולה; אין ליצור הפקדה נוספת.');
        } finally { busyRef.current = false; setBusy(false); }
    };
    return <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4" dir="rtl">
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="topup-title" className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 id="topup-title" className="text-xl font-bold">הוספת כסף לארנק</h2>
                <button type="button" aria-label="סגירה" onClick={onClose} disabled={busy} className="p-2">✕</button>
            </div>
            <p className="font-bold">{wallet.name} <span className="font-mono text-sm">{wallet.walletNumber}</span></p>
            <p className="text-sm text-gray-600 mb-5">יתרה מוצגת: ₪{money(wallet.currentBalance)}. הסכום יתווסף ליתרה העדכנית בשרת.</p>
            <form onSubmit={submit} className="space-y-4">
                <label className="block text-sm font-bold">סכום להוספה בש״ח
                    <input autoComplete="off" inputMode="decimal" dir="ltr" aria-label="סכום להוספה" required disabled={busy || !!pending}
                        value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full mt-1 border rounded-xl p-3 text-right disabled:bg-gray-100" />
                </label>
                {!!wallet.categoryBalances?.length && <label className="block text-sm font-bold">קטגוריה לזיכוי
                    <select aria-label="קטגוריה לזיכוי" required disabled={busy || !!pending} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className="w-full mt-1 border rounded-xl p-3">
                        <option value="">בחר קטגוריה</option>
                        {wallet.categoryBalances.map((category) => <option key={category.categoryName} value={category.categoryName}>{category.categoryName} — ₪{money(category.balance)}</option>)}
                    </select>
                </label>}
                <label className="block text-sm font-bold">הערה לפעולה, לא חובה
                    <textarea maxLength={500} rows={2} disabled={busy || !!pending} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full mt-1 border rounded-xl p-3" />
                </label>
                {Number(amount) > 0 && <p className="text-sm">תתווסף יתרה של <strong>₪{money(amount)}</strong>{categoryName ? ` לקטגוריה ${categoryName}` : ''}.</p>}
                {error && <p role="alert" className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{error}</p>}
                {pending && <p className="text-xs text-gray-500 break-all">מזהה פעולה: <span dir="ltr">{pending.requestId}</span></p>}
                <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#526f52] text-white p-3 font-bold disabled:opacity-50">
                    {busy ? 'מבצע...' : pending ? 'בדיקה חוזרת של אותה פעולה' : 'אישור הוספת כסף'}
                </button>
            </form>
        </section>
    </div>;
}
