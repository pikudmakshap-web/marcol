import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { useWalletStore } from '../store/walletStore';
import { useNavigate } from 'react-router-dom';

function DevUserSwitch() {
    const { user: currentUser, devSwitch } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loadingId, setLoadingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        authService.getDevUsers()
            .then(data => setUsers(data))
            .catch(err => console.error("Failed to load dev users", err));
    }, []);

    const handleSwitch = async (userId, targetRole) => {
        setLoadingId(userId);
        try {
            await devSwitch(userId);
            // Force refetch wallets so the new user's restricted view is loaded
            await useWalletStore.getState().fetchWallets(true);

            if (targetRole === 'admin') navigate('/admin/dashboard');
            else if (targetRole === 'cashier') navigate('/pos/checkout');
            else if (targetRole === 'officer') navigate('/officer/dashboard');
            setIsOpen(false);
        } catch (err) {
            console.error("Switch failed", err);
        } finally {
            setLoadingId(null);
        }
    };

    if (users.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 z-[999] font-display" dir="rtl">
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-4 bg-white/90 backdrop-blur-md border border-purple-200 shadow-2xl rounded-2xl p-4 w-72 max-h-80 overflow-y-auto">
                    <h3 className="font-bold text-sm text-purple-800 mb-3 border-b border-purple-100 pb-2">
                        כלי פיתוח: החלפת משתמש זמנית
                    </h3>
                    <div className="space-y-2">
                        {users.map(u => (
                            <button
                                key={u.id}
                                disabled={loadingId === u.id || currentUser?.id === u.id}
                                onClick={() => handleSwitch(u.id, u.role)}
                                className={`w-full text-right p-3 rounded-xl flex items-center justify-between transition-all ${currentUser?.id === u.id
                                    ? 'bg-purple-50 border border-purple-200 opacity-60'
                                    : 'bg-gray-50 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-200'
                                    }`}
                            >
                                <div>
                                    <div className="font-bold text-sm text-gray-800">{u.fullName || u.username}</div>
                                    <div className="text-[10px] text-gray-500">{u.role} | {u.username}</div>
                                </div>
                                {currentUser?.id === u.id && (
                                    <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded-full">מחובר</span>
                                )}
                                {loadingId === u.id && (
                                    <span className="material-symbols-outlined animate-spin text-purple-500 text-sm">refresh</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-purple-600 text-white shadow-purple-500/50' : 'bg-gray-800 text-white shadow-gray-800/50 hover:scale-110'
                    }`}
            >
                <span className="material-symbols-outlined text-2xl">
                    {isOpen ? 'close' : 'admin_panel_settings'}
                </span>
            </button>
        </div>
    );
}

export default DevUserSwitch;
