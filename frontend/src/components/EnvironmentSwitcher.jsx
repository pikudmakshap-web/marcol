import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const DEFAULT_SYMBOL_IMAGE_URLS = [
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23ecfdf5'/%3E%3Cpath d='M14 29L32 17l18 12v19a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V29z' fill='%2316a34a'/%3E%3Crect x='27' y='36' width='10' height='14' rx='2' fill='%23dcfce7'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23eff6ff'/%3E%3Ccircle cx='24' cy='30' r='8' fill='%232563eb'/%3E%3Crect x='32' y='24' width='14' height='6' rx='3' fill='%231d4ed8'/%3E%3Crect x='34' y='32' width='10' height='5' rx='2.5' fill='%233b82f6'/%3E%3C/svg%3E"
];

const roleLabels = {
    admin: 'מנהל מערכת',
    officer: 'קצין',
    cashier: 'קופאי',
    superadmin: 'מנהל על'
};

const EnvironmentSwitcher = () => {
    const { user, switchEnvironment } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const environments = user?.authorizedEnvironments || [];
    const canSwitch = environments.length > 1;

    const handleSwitch = async (envId) => {
        if (envId === user.environmentId) {
            setIsOpen(false);
            return;
        }

        setLoading(true);
        try {
            await switchEnvironment(envId);
            toast.success('הסביבה הוחלפה בהצלחה');
            setIsOpen(false);
            window.location.reload();
        } catch (err) {
            toast.error('שגיאה בהחלפת סביבה');
        } finally {
            setLoading(false);
        }
    };

    if (!canSwitch) return null;

    const currentEnv = environments.find((e) => e.id === user.environmentId);
    const extractEnvironmentParts = (value) => {
        const raw = String(value || '');
        const symbols = raw.match(/\p{Extended_Pictographic}/gu) || [];
        const baseName = raw.replace(/\p{Extended_Pictographic}/gu, '').trim();
        return { baseName, symbols };
    };
    const { baseName, symbols: textSymbols } = extractEnvironmentParts(currentEnv?.name || '');
    const imageSymbols = Array.isArray(currentEnv?.symbolImageUrls) && currentEnv.symbolImageUrls.length > 0
        ? currentEnv.symbolImageUrls.slice(0, 4)
        : DEFAULT_SYMBOL_IMAGE_URLS;

    return (
        <div className="relative z-[20000]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-5 py-2.5 w-[280px] bg-white/95 backdrop-blur-md rounded-[24px]  border border-transparent hover:shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition-all h-[56px]"
            >
                {/* <span className={`material-symbols-outlined text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} text-[20px]`}>
                    expand_more
                </span> */}
                <div className="w-8 h-8 bg-[#ecfdf5] rounded-xl flex items-center justify-center text-[#3ce619] shadow-inner shrink-0">
                    <span className="material-symbols-outlined text-[18px]">storefront</span>
                </div>

                <div className="text-right leading-tight">
                    <p className="text-[11px] text-slate-400 font-bold leading-none mb-0.5">סביבה פעילה</p>
                    <div className="flex items-center justify-end gap-1">
                        {imageSymbols.map((imageSrc, index) => (
                            <span key={`switcher-img-${index}`} className="w-4 h-4 overflow-hidden">
                                <img src={imageSrc} alt={`env-symbol-${index + 1}`} className="w-full h-full object-contain" />
                            </span>
                        ))}
                        {textSymbols.slice(0, 4).map((symbol, index) => (
                            <span key={`switcher-text-${index}`} className="w-4 h-4 text-[10px] flex items-center justify-center">
                                {symbol}
                            </span>
                        ))}
                        <p className="text-[21px] font-black text-[#2d3748] tracking-tight leading-none">
                            {baseName || currentEnv?.name || 'בחר סביבה...'}
                        </p>
                    </div>
                </div>

            </button>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.2)] border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[20001]">
                    <div className="p-3 border-b border-gray-50 bg-gray-50/70">
                        <p className="text-xs font-bold text-gray-500">בחר סביבה לעבודה</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                        {environments.map((env) => (
                            <button
                                key={env.id}
                                onClick={() => handleSwitch(env.id)}
                                disabled={loading}
                                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                                    user.environmentId === env.id ? 'text-[#3ce619] font-bold bg-[#f7fff5]' : 'text-gray-700'
                                }`}
                            >
                                <div className="flex flex-col text-right">
                                    <span className="text-sm">{env.name}</span>
                                    <span className="text-[10px] opacity-60">({roleLabels[env.role] || env.role})</span>
                                </div>
                                {user.environmentId === env.id && (
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnvironmentSwitcher;
