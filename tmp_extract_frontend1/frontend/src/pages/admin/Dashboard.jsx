import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getForceActiveMessage } from '../../services/messageService';
import { socket } from '../../services/socketService';
import { useDashboardStore } from '../../store/dashboardStore';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

function Dashboard() {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const { user: currentUser } = useAuthStore();
    const { dashboardData, loading, fetchDashboardStats } = useDashboardStore();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notificationSearchTerm, setNotificationSearchTerm] = useState('');
    const notificationsRef = useRef(null);

    // System Message viewing State
    const [isSystemMessageOpen, setIsSystemMessageOpen] = useState(false);
    const [currentSystemMessage, setCurrentSystemMessage] = useState(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setIsNotificationsOpen(false);
            }
        };

        if (isNotificationsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isNotificationsOpen]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchDashboardStats();

        // Listen for real-time updates to keep the dashboard (and low stock alerts) fresh
        const handleUpdate = () => fetchDashboardStats(true);
        socket.on('product_updated', handleUpdate);
        socket.on('product_added', handleUpdate);
        socket.on('product_deleted', handleUpdate);

        // Listen for generic data updates (like wallets and transactions)
        const handleDataUpdate = (data) => {
            if (data?.type === 'wallet' || data?.type === 'transaction') {
                fetchDashboardStats(true);
            }
        };
        socket.on('data_update', handleDataUpdate);

        return () => {
            socket.off('product_updated', handleUpdate);
            socket.off('product_added', handleUpdate);
            socket.off('product_deleted', handleUpdate);
            socket.off('data_update', handleDataUpdate);
        };
    }, []);

    // Extract Data
    const { budget, sales, wallets, topProducts, walletUsage, lowStockProducts } = dashboardData;

    const formatDate = (date) => {
        return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    if (loading) {
        return <LoadingSpinner fullScreen={false} />;
    }

    const handleOpenSystemMessage = async () => {
        try {
            const msg = await getForceActiveMessage();
            if (msg) {
                setCurrentSystemMessage(msg);
                setIsSystemMessageOpen(true);
            } else {
                toast.error('אין הודעת מערכת פעילה במערכת');
            }
        } catch (error) {
            toast.error('שגיאה בטעינת הודעת המערכת');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3rem)] max-w-[1920px] mx-auto overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between mb-3 shrink-0 relative z-50">
                {/* Right Side: Notifications and Greeting */}
                <div className="flex items-center gap-6">
                    {/* Notifications */}
                    <div className="flex items-center gap-3 relative" ref={notificationsRef}>
                        <button
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors relative"
                        >
                            <span className="material-symbols-outlined text-[20px]">notifications</span>
                            {lowStockProducts.length > 0 && (
                                <div className="absolute top-2.5 right-3 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                            )}
                        </button>

                        <button
                            onClick={handleOpenSystemMessage}
                            className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-[#526f52] hover:bg-gray-50 transition-colors shrink-0"
                            title="צפייה בהודעת מערכת פעילה"
                        >
                            <span className="material-symbols-outlined text-[20px]">campaign</span>
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col z-50 animate-fade-in-up">
                                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{lowStockProducts.length}</span>
                                    <h3 className="font-bold text-[#2d3748] text-sm">התראות מלאי (מוצרים חסרים)</h3>
                                </div>

                                {/* Search Bar inside Notifications */}
                                <div className="p-3 border-b border-gray-100 bg-white">
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                                        <input
                                            type="text"
                                            placeholder="חיפוש בהתראות..."
                                            value={notificationSearchTerm}
                                            onChange={(e) => setNotificationSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pr-9 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {lowStockProducts.length === 0 ? (
                                        <div className="p-6 text-center text-gray-500 text-sm">אין התראות מלאי כרגע</div>
                                    ) : (
                                        lowStockProducts
                                            .filter(product => product.name.toLowerCase().includes(notificationSearchTerm.toLowerCase()))
                                            .map(product => (
                                                <div key={product.id} className="p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center gap-3 text-right group">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden bg-white">
                                                        {product.imageUrl ? (
                                                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-gray-400 text-[18px]">inventory_2</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-1">
                                                        <div className="font-bold text-sm text-[#2d3748] truncate">{product.name}</div>
                                                        <div className="text-xs text-red-500 font-medium">
                                                            {product.quantity === 0 ? 'אזל מהמלאי' : currentUser?.role === 'admin' ? `נשארו יחידות אחרונות (${product.quantity})` : 'נשארו יחידות אחרונות'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Greeting */}
                    <div className="text-right">
                        <div className="text-gray-400 text-xs mb-0.5">{formatDate(currentTime)}</div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-extrabold text-[#2d3748] tracking-tight">בוקר טוב, {currentUser?.fullName?.split(' ')[0] || 'איתי'}</h1>
                            <span className="material-symbols-outlined text-[#3ce619] text-3xl">eco</span>
                        </div>
                    </div>
                </div>

                {/* Left Side: Title and Logo */}
                <div className="flex items-center justify-center gap-3 pointer-events-none">
                    <img src="/סמל_צהל.png" alt="סמל צהל" className="h-14 w-auto object-contain" />
                    <h2 className="text-3xl font-black text-[#166534] tracking-tight">קולבוסטינה</h2>
                </div>
            </header>

            {/* Main Layout: Right Side (Widgets) vs Left Side (Content) */}
            <div className="flex-1 flex gap-5 min-h-0">

                {/* Right Column (Widgets) - Fixed Width */}
                <div className="w-[280px] flex flex-col gap-3 h-full shrink-0">

                    {/* 1. Wallets Card */}
                    <div className="bg-white rounded-[28px] p-4 shadow-sm border border-gray-100 relative overflow-hidden group h-[120px] shrink-0 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                                <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                            </div>
                            <h3 className="text-gray-400 font-bold text-xs">ארנקים פעילים</h3>
                        </div>
                        <div className="text-right z-10 mb-2">
                            <span className="text-4xl font-bold text-[#2d3748]">{wallets.count}</span>
                        </div>
                    </div>

                    {/* 2. Sales Card */}
                    <div className="bg-white rounded-[28px] p-4 shadow-sm border border-gray-100 relative overflow-hidden group h-[120px] shrink-0 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="w-8 h-8 bg-[#e8f5e9] rounded-full flex items-center justify-center text-[#3ce619]">
                                <span className="material-symbols-outlined text-sm">trending_up</span>
                            </div>
                            <h3 className="text-gray-400 font-bold text-xs">מכירות היום</h3>
                        </div>
                        <div className="text-right z-10 mb-2">
                            <span className="text-3xl font-bold text-[#2d3748]">₪{sales.today.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* 3. Top Products (Fills rest) */}
                    <div className="bg-white rounded-[28px] p-4 shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                        <h3 className="text-sm font-bold text-[#2d3748] text-right mb-2 border-r-4 border-orange-400 pr-3 shrink-0">נמכרים ביותר</h3>
                        <div className="flex-1 flex flex-col justify-evenly min-h-0">
                            {topProducts.map((prod, idx) => (
                                <div key={prod.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-gray-50 rounded-xl transition-colors group">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`font-bold text-sm w-4 text-center shrink-0 ${idx < 3 ? 'text-[#3ce619]' : 'text-gray-300'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-sm shrink-0 ${prod.imageUrl ? 'bg-white border border-gray-100' : prod.color} overflow-hidden`}>
                                            {prod.imageUrl ? (
                                                <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-[16px]">{prod.icon}</span>
                                            )}
                                        </div>
                                        <div className="text-right min-w-0">
                                            <h4 className="font-bold text-[#2d3748] text-xs truncate max-w-[90px]" title={prod.name}>{prod.name}</h4>
                                            <div className="text-[9px] text-gray-400 leading-tight">
                                                ₪{prod.revenue}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-left pl-1">
                                        <span className="font-black text-[#2d3748] text-sm block leading-none">{prod.sales}</span>
                                        <span className="text-[9px] text-gray-400 block -mt-0.5">יח'</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Left Column (Main Stats) */}
                <div className="flex-1 flex flex-col gap-5 h-full">

                    {/* Budget Overview (Top) - 38% Height */}
                    <div className="h-[38%] bg-[#f0fdf4] overflow-hidden rounded-[28px] p-5 relative flex items-center shadow-[0_4px_30px_rgba(60,230,25,0.05)] border border-[#3ce619]/10">
                        {/* Background Pattern */}
                        <div className="absolute right-0 top-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 90% 10%, #3ce619 0%, transparent 40%)' }}></div>

                        <div className="flex-1 flex flex-col justify-center h-full z-10 py-1">
                            <div className="text-right mb-2">
                                <h3 className="text-[#526f52] font-bold text-base mb-1">יתרה תקציבית</h3>
                                <div className="flex items-center justify-end gap-3">
                                    <span className="bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                        פעיל
                                    </span>
                                    <span className="text-5xl font-black text-[#2d3748] tracking-tight">₪{budget.current.toLocaleString()}</span>
                                </div>
                                <p className="text-gray-400 text-xs mt-1 font-medium">סך היתרות הזמינות בכל הארנקים יחד</p>
                            </div>

                            <div className="flex gap-2 justify-end mt-2">
                                <button className="bg-white text-gray-600 px-5 py-2 rounded-full font-bold shadow-sm hover:bg-gray-50 transition-all border border-gray-100 text-xs">
                                    פירוט מלא
                                </button>
                                <button className="bg-[#2d3748] text-white px-5 py-2 rounded-full font-bold shadow-lg hover:bg-black transition-all flex items-center gap-1.5 text-xs">
                                    <span className="material-symbols-outlined text-xs">add</span>
                                    <span>הוסף הוצאה</span>
                                </button>
                            </div>
                        </div>

                        {/* Decorative Icon instead of Progress */}
                        <div className="w-48 h-48 relative flex items-center justify-center shrink-0 mr-6 bg-white/50 rounded-full border-[8px] border-white shadow-sm">
                            <span className="material-symbols-outlined text-7xl text-[#3ce619]">
                                account_balance_wallet
                            </span>
                        </div>
                    </div>

                    {/* Wallet Usage (Bottom) - Fills rest */}
                    <div className="flex-1 bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-3 shrink-0">
                            <button className="text-[#3ce619] font-bold text-xs hover:underline">כל הארנקים</button>
                            <h3 className="text-lg font-bold text-[#2d3748] border-r-4 border-blue-400 pr-3">שימוש בארנקים</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-200">
                            <div className="flex text-[10px] font-bold text-gray-400 px-3 pb-2 sticky top-0 bg-white z-10 border-b border-gray-50 mb-1">
                                <span className="w-20 text-center">סכום</span>
                                <span className="w-16 text-center">שעה</span>
                                <span className="w-20 text-center">תאריך</span>
                                <span className="flex-1 text-left pl-2">סוג ארנק</span>
                                <span className="flex-1 text-left pl-2">משתמש</span>
                            </div>

                            {/* Usage List */}
                            {walletUsage.map((usage) => (
                                <div key={usage.id} className="flex items-center hover:bg-gray-50 p-2.5 rounded-2xl transition-colors group">
                                    <div className="w-20 text-center font-black text-sm text-[#2d3748]">
                                        ₪{usage.amount.toFixed(2)}
                                    </div>
                                    <div className="w-16 text-center text-gray-400 text-xs">{usage.time}</div>
                                    <div className="w-20 text-center text-gray-400 text-xs">{usage.date}</div>
                                    <div className="flex-1 text-right text-gray-600 text-xs flex items-center justify-end gap-2">
                                        <span>{usage.wallet}</span>
                                        <span className={`material-symbols-outlined text-[16px] ${usage.color.split(' ')[1]}`}>{usage.icon}</span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-end gap-3">
                                        <span className="font-bold text-[#2d3748] text-xs">{usage.name}</span>
                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0 border border-gray-200">
                                            {usage.name.charAt(0)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>

            {/* System Message Modal */}
            {isSystemMessageOpen && currentSystemMessage && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full transform transition-all border border-gray-100">
                        <div className="bg-[#526f52] p-6 text-white flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-3xl">campaign</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{currentSystemMessage.title}</h2>
                                <p className="text-white/80 text-sm mt-1">הודעת מערכת אחרונה</p>
                            </div>
                        </div>

                        <div className="p-8">
                            <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                                {currentSystemMessage.content}
                            </p>
                            <div className="mt-6 text-xs text-gray-400">
                                ההודעה פורסמה בתאריך: {formatDate(new Date(currentSystemMessage.createdAt))}
                            </div>
                        </div>

                        <div className="bg-gray-50 px-8 py-5 text-left border-t border-gray-100">
                            <button
                                onClick={() => setIsSystemMessageOpen(false)}
                                className="bg-[#526f52] hover:bg-[#435c43] text-white px-8 py-3 rounded-xl font-bold transition-colors"
                            >
                                סגור הודעה
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
