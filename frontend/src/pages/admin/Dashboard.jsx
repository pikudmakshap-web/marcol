import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Mock Data
    const budget = { total: 20000, current: 12450 };
    const sales = { today: 3820, goal: 5000 };
    const wallets = { count: 8, totalBalance: 4250 };

    // Top Selling Products
    const topProducts = [
        { id: 1, name: "קפוצ'ינו גדול", sales: 45, revenue: 810, icon: "coffee", color: "bg-orange-100 text-orange-600" },
        { id: 2, name: "קרואסון חמאה", sales: 32, revenue: 512, icon: "bakery_dining", color: "bg-amber-100 text-amber-600" },
        { id: 3, name: "כריך חביתה", sales: 28, revenue: 784, icon: "lunch_dining", color: "bg-green-100 text-green-600" },
        { id: 4, name: "מיץ תפוזים", sales: 24, revenue: 360, icon: "local_bar", color: "bg-orange-50 text-orange-500" },
        { id: 5, name: "עוגת גבינה", sales: 18, revenue: 450, icon: "cake", color: "bg-pink-100 text-pink-500" },
    ];

    // Recent Wallet Usage
    const walletUsage = [
        { id: 1, name: "דניאל כהן", wallet: "ארנק זהב", time: "10:42", amount: 18.00, icon: "account_balance_wallet", color: "bg-yellow-100 text-yellow-600" },
        { id: 2, name: "רונית לוי", wallet: "ארנק סטודנט", time: "10:35", amount: 28.00, icon: "school", color: "bg-blue-100 text-blue-600" },
        { id: 3, name: "יוסי אברהם", wallet: "ארנק עובד", time: "10:15", amount: 12.00, icon: "badge", color: "bg-purple-100 text-purple-600" },
        { id: 4, name: "מיכל שחר", wallet: "ארנק רגיל", time: "09:50", amount: 45.00, icon: "wallet", color: "bg-gray-100 text-gray-600" },
        { id: 5, name: "אורח", wallet: "חד פעמי", time: "09:30", amount: 8.00, icon: "local_activity", color: "bg-green-100 text-green-600" },
        { id: 6, name: "אבי כהן", wallet: "ארנק זהב", time: "09:15", amount: 110.00, icon: "account_balance_wallet", color: "bg-yellow-100 text-yellow-600" },
        { id: 7, name: "שרה לוי", wallet: "ארנק רגיל", time: "08:45", amount: 22.50, icon: "wallet", color: "bg-gray-100 text-gray-600" },
    ];

    const formatDate = (date) => {
        return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3rem)] max-w-[1920px] mx-auto overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-3">
                    <button className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors relative">
                        <span className="material-symbols-outlined text-[20px]">notifications</span>
                        <div className="absolute top-2.5 right-3 w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                    </button>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="חיפוש..."
                            className="bg-white rounded-full py-2.5 px-5 pr-10 w-56 shadow-sm border-none text-xs focus:ring-2 focus:ring-[#3ce619]/20"
                        />
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-gray-400 text-xs mb-0.5">{formatDate(currentTime)}</div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-extrabold text-[#2d3748] tracking-tight">בוקר טוב, איתי</h1>
                        <span className="material-symbols-outlined text-[#3ce619] text-3xl">eco</span>
                    </div>
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
                        <div className="flex-1 flex flex-col justify-between min-h-0">
                            {topProducts.map((prod, idx) => (
                                <div key={prod.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-gray-50 rounded-xl transition-colors group">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`font-bold text-sm w-4 text-center shrink-0 ${idx < 3 ? 'text-[#3ce619]' : 'text-gray-300'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-sm shrink-0 ${prod.color}`}>
                                            <span className="material-symbols-outlined text-[16px]">{prod.icon}</span>
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
                    <div className="h-[38%] bg-[#f0fdf4] rounded-[28px] p-5 relative flex items-center shadow-[0_4px_30px_rgba(60,230,25,0.05)] border border-[#3ce619]/10">
                        {/* Background Pattern */}
                        <div className="absolute right-0 top-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 90% 10%, #3ce619 0%, transparent 40%)' }}></div>

                        <div className="flex-1 flex flex-col justify-center h-full z-10 py-1">
                            <div className="text-right mb-2">
                                <h3 className="text-[#526f52] font-bold text-base mb-1">יתרה תקציבית</h3>
                                <div className="flex items-center justify-end gap-3">
                                    <span className="bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded-lg text-[10px] font-bold">+8.2%</span>
                                    <span className="text-5xl font-black text-[#2d3748] tracking-tight">₪{budget.current.toLocaleString()}</span>
                                </div>
                                <p className="text-gray-400 text-xs mt-1 font-medium">מתוך תקציב חודשי ש₪{budget.total.toLocaleString()}</p>
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

                        {/* Circular Progress */}
                        <div className="w-48 h-48 relative flex items-center justify-center shrink-0 mr-6">
                            <svg className="transform -rotate-90 w-full h-full">
                                <circle cx="96" cy="96" r="70" stroke="#e2e8f0" strokeWidth="10" fill="none" />
                                <circle cx="96" cy="96" r="70" stroke="#3ce619" strokeWidth="10" fill="none" strokeDasharray={`${2 * Math.PI * 70}`} strokeDashoffset={`${2 * Math.PI * 70 * (1 - 0.62)}`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-4xl font-extrabold text-[#2d3748]">62%</span>
                                <span className="text-gray-400 text-xs font-bold mt-1">נוצל</span>
                            </div>
                        </div>
                    </div>

                    {/* Wallet Usage (Bottom) - Fills rest */}
                    <div className="flex-1 bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-3 shrink-0">
                            <button className="text-[#3ce619] font-bold text-xs hover:underline">כל הארנקים</button>
                            <h3 className="text-lg font-bold text-[#2d3748] border-r-4 border-blue-400 pr-3">שימוש בארנקים</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-200">
                            {/* Header Row */}
                            <div className="flex text-[10px] font-bold text-gray-400 px-3 pb-2 sticky top-0 bg-white z-10 border-b border-gray-50 mb-1">
                                <span className="w-20 text-center">סכום</span>
                                <span className="w-16 text-center">שעה</span>
                                <span className="flex-1 text-right">סוג ארנק</span>
                                <span className="flex-1 text-right">משתמש</span>
                            </div>

                            {/* Usage List */}
                            {walletUsage.map((usage) => (
                                <div key={usage.id} className="flex items-center hover:bg-gray-50 p-2.5 rounded-2xl transition-colors group">
                                    <div className="w-20 text-center font-black text-sm text-[#2d3748]">
                                        ₪{usage.amount.toFixed(2)}
                                    </div>
                                    <div className="w-16 text-center text-gray-400 text-xs">{usage.time}</div>
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
        </div>
    );
}

export default Dashboard;
