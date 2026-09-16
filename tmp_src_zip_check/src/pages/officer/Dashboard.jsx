import Sidebar from '../../components/Sidebar';
import { useState, useEffect, useRef } from 'react';
import { getDashboardStats } from '../../services/dashboardService';
import { socket } from '../../services/socketService';

const OfficerDashboard = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [shiftTime, setShiftTime] = useState({ hours: 4, minutes: 32, seconds: 15 });

    // Notifications State
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const notificationsRef = useRef(null);

    // Close notifications on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setIsNotificationsOpen(false);
            }
        };
        if (isNotificationsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isNotificationsOpen]);

    // Fetch stats and listen to live updates
    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await getDashboardStats();
                setLowStockProducts(data.lowStockProducts || []);
            } catch (error) {
                console.error("Error loading dashboard stats:", error);
            }
        };
        loadStats();

        const handleUpdate = () => loadStats();
        socket.on('product_updated', handleUpdate);
        socket.on('product_added', handleUpdate);
        socket.on('product_deleted', handleUpdate);

        return () => {
            socket.off('product_updated', handleUpdate);
            socket.off('product_added', handleUpdate);
            socket.off('product_deleted', handleUpdate);
        };
    }, []);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            setShiftTime(prev => ({
                ...prev,
                seconds: prev.seconds + 1
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatShiftTime = () => {
        const { hours, minutes, seconds } = shiftTime;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    };

    const formatDate = () => {
        const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        return `יום ${days[currentTime.getDay()]}, ${currentTime.getDate()} ב${months[currentTime.getMonth()]}`;
    };

    const quickProducts = [
        { icon: 'local_cafe', name: 'קפה' },
        { icon: 'lunch_dining', name: 'כריך' },
        { icon: 'bakery_dining', name: 'מאפה' },
        { icon: 'local_drink', name: 'שתייה קלה' },
        { icon: 'fastfood', name: 'חטיף' },
        { icon: 'icecream', name: 'גלידה' }
    ];

    const recentTransactions = [
        { id: 1, type: 'הכנסה', amount: 450, customer: 'יוסי כהן', time: '14:32' },
        { id: 2, type: 'הכנסה', amount: 180, customer: 'שרה לוי', time: '13:45' },
        { id: 3, type: 'הוצאה', amount: -120, customer: 'החזר כספי', time: '12:20' },
    ];

    return (
        <div className="bg-background-light dark:bg-background-dark text-sage-600 dark:text-sage-100 font-display min-h-screen bg-noise overflow-x-hidden selection:bg-primary selection:text-white">
            {/* Background blobs */}
            <div
                className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse"
                style={{ animationDuration: '10s' }}
            ></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-terracotta-200/20 dark:bg-terracotta-500/10 rounded-full blur-[100px] -z-10"></div>

            <div className="flex h-screen p-4 gap-6 max-w-[1920px] mx-auto relative z-10">
                <Sidebar userRole="officer" />

                {/* Main Content */}
                <main className="flex-1 lg:mr-32 flex flex-col gap-6 h-full overflow-y-auto pr-2 pl-4 py-2">
                    {/* Header */}
                    <header className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-sage-400 font-medium mb-1">{formatDate()}</p>
                            <h1 className="text-4xl font-extrabold text-sage-600 dark:text-white tracking-tight">
                                בוקר טוב, איתי <span className="inline-block animate-bounce ml-2">🌱</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Search */}
                            <div className="hidden md:flex items-center bg-white dark:bg-sage-600/30 rounded-full px-5 py-3 shadow-sm border border-sage-100 dark:border-white/5 w-64">
                                <span className="material-icons-round text-sage-400 text-xl ml-2">search</span>
                                <input
                                    className="bg-transparent border-none outline-none text-sm placeholder-sage-300 w-full focus:ring-0 p-0 text-sage-600 dark:text-white"
                                    placeholder="חיפוש מהיר..."
                                    type="text"
                                />
                            </div>
                            {/* Notifications */}
                            <div className="relative" ref={notificationsRef}>
                                <button
                                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                    className="relative w-12 h-12 rounded-full bg-white dark:bg-sage-600/30 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow group"
                                >
                                    <span className="material-icons-round text-sage-500 group-hover:text-primary transition-colors">
                                        notifications
                                    </span>
                                    {lowStockProducts.length > 0 && (
                                        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-terracotta-500 rounded-full animate-pulse ring-2 ring-white dark:ring-background-dark"></span>
                                    )}
                                </button>

                                {/* Notifications Dropdown */}
                                {isNotificationsOpen && (
                                    <div className="absolute top-14 right-0 w-80 bg-white dark:bg-sage-700 rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col z-50 animate-fade-in-up">
                                        <div className="p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-between items-center">
                                            <span className="text-xs bg-terracotta-100 dark:bg-terracotta-500/20 text-terracotta-600 dark:text-terracotta-300 px-2 py-0.5 rounded-full font-bold">{lowStockProducts.length}</span>
                                            <h3 className="font-bold text-sage-600 dark:text-white text-sm">התראות מלאי (מוצרים חסרים)</h3>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {lowStockProducts.length === 0 ? (
                                                <div className="p-6 text-center text-sage-400 text-sm">אין התראות מלאי כרגע</div>
                                            ) : (
                                                lowStockProducts.map(product => (
                                                    <div key={product.id} className="p-3 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3 text-right group">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden bg-white">
                                                            {product.imageUrl ? (
                                                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-gray-400 text-[18px]">inventory_2</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0 pr-1">
                                                            <div className="font-bold text-sm text-sage-600 dark:text-white truncate">{product.name}</div>
                                                            <div className="text-xs text-terracotta-500 font-medium">
                                                                {product.quantity === 0 ? 'אזל מהמלאי' : `נשארו יחידות אחרונות`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Dashboard Grid */}
                    <div className="grid grid-cols-12 gap-6 pb-8">
                        {/* Budget Balance Card */}
                        <div className="col-span-12 lg:col-span-8 bg-sage-100/50 dark:bg-white/5 rounded-3xl p-8 relative overflow-hidden pebble shadow-soft border border-white/50 dark:border-white/5 group hover:bg-sage-100/80 transition-all duration-500">
                            <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-700"></div>
                            <div className="flex flex-col md:flex-row justify-between relative z-10 h-full">
                                <div className="flex flex-col justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-sage-500 dark:text-sage-200 mb-2">יתרה תקציבית</h2>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-extrabold text-sage-600 dark:text-white font-display">₪12,450</span>
                                            <span className="text-primary font-bold bg-primary/10 px-3 py-1 rounded-full text-sm">+8.2%</span>
                                        </div>
                                        <p className="text-sage-400 text-sm mt-2">מתוך תקציב חודשי של ₪20,000</p>
                                    </div>
                                    <div className="mt-8 flex gap-3">
                                        <button className="bg-sage-600 dark:bg-white text-white dark:text-sage-600 px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                                            <span className="material-icons-round text-sm">add</span>
                                            הוסף הוצאה
                                        </button>
                                        <button className="bg-white dark:bg-sage-700 text-sage-600 dark:text-white border border-sage-200 dark:border-white/10 px-6 py-3 rounded-full font-bold hover:bg-sage-50 dark:hover:bg-white/5 transition-all">
                                            פירוט מלא
                                        </button>
                                    </div>
                                </div>
                                {/* Circular Progress */}
                                <div className="mt-6 md:mt-0 flex items-center justify-center relative w-40 h-40">
                                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                                        <circle
                                            className="text-sage-200 dark:text-white/10"
                                            cx="50"
                                            cy="50"
                                            fill="transparent"
                                            r="40"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                        ></circle>
                                        <circle
                                            className="text-primary"
                                            cx="50"
                                            cy="50"
                                            fill="transparent"
                                            r="40"
                                            stroke="currentColor"
                                            strokeDasharray="251.2"
                                            strokeDashoffset="60"
                                            strokeLinecap="round"
                                            strokeWidth="8"
                                        ></circle>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl font-bold text-sage-600 dark:text-white">62%</span>
                                        <span className="text-xs text-sage-400">נוצל</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side Widgets */}
                        <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-6">
                            {/* Shift Status */}
                            <div className="bg-terracotta-100/50 dark:bg-terracotta-500/20 rounded-3xl p-6 relative overflow-hidden pebble-alt border border-white/50 dark:border-white/5">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-terracotta-500 dark:text-terracotta-200">סטטוס משמרת</h3>
                                        <p className="text-sm text-sage-500/80 dark:text-sage-200/60">התחלה: 08:00</p>
                                    </div>
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ring-4 ring-green-500/20"></span>
                                </div>
                                <div className="flex items-end justify-between">
                                    <div className="text-3xl font-bold text-sage-600 dark:text-white">{formatShiftTime()}</div>
                                    <button className="w-10 h-10 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center hover:bg-white hover:text-terracotta-500 transition-colors">
                                        <span className="material-icons-round">pause</span>
                                    </button>
                                </div>
                            </div>

                            {/* Sales Stats */}
                            <div className="bg-white dark:bg-sage-600/30 rounded-3xl p-6 pebble border border-sage-100 dark:border-white/5 shadow-soft flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sage-500 dark:text-sage-200 font-medium">מכירות היום</h3>
                                    <span className="material-icons-round text-primary bg-primary/10 p-1 rounded-full text-sm">trending_up</span>
                                </div>
                                <div className="text-3xl font-bold text-sage-600 dark:text-white mb-1">₪3,820</div>
                                <div className="w-full bg-sage-100 dark:bg-white/10 h-2 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-sage-400 h-full rounded-full w-[70%]"></div>
                                </div>
                                <p className="text-xs text-sage-400 mt-2 text-left ltr">Goal: ₪5,000</p>
                            </div>
                        </div>

                        {/* Quick POS Actions */}
                        <div className="col-span-12 md:col-span-5 bg-white dark:bg-sage-600/20 rounded-[2.5rem] p-6 shadow-soft border border-sage-50 dark:border-white/5">
                            <h3 className="text-xl font-bold text-sage-600 dark:text-white mb-6 mr-2">קופה מהירה</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {quickProducts.map((product, index) => (
                                    <button
                                        key={index}
                                        className="aspect-[4/3] rounded-2xl bg-sage-50 dark:bg-white/5 hover:bg-primary/20 hover:text-primary-dark transition-all flex flex-col items-center justify-center gap-2 group border border-transparent hover:border-primary/30"
                                    >
                                        <span className="material-icons-round text-sage-400 group-hover:text-primary transition-colors text-2xl">
                                            {product.icon}
                                        </span>
                                        <span className="text-xs font-medium">{product.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recent Transactions */}
                        <div className="col-span-12 md:col-span-7 bg-white dark:bg-sage-600/20 rounded-[2.5rem] p-6 shadow-soft border border-sage-50 dark:border-white/5">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-sage-600 dark:text-white">פעילות אחרונה</h3>
                                <button className="text-sm text-primary font-medium hover:underline">צפה בהכל</button>
                            </div>
                            <div className="space-y-3">
                                {recentTransactions.map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="flex items-center justify-between p-4 bg-sage-50 dark:bg-white/5 rounded-2xl hover:bg-sage-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${transaction.type === 'הכנסה' ? 'bg-primary/20 text-primary' : 'bg-red-100 dark:bg-red-900/20 text-red-500'
                                                }`}>
                                                <span className="material-icons-round text-sm">
                                                    {transaction.type === 'הכנסה' ? 'arrow_downward' : 'arrow_upward'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sage-600 dark:text-white">{transaction.customer}</p>
                                                <p className="text-xs text-sage-400">{transaction.time}</p>
                                            </div>
                                        </div>
                                        <div className={`text-lg font-bold ${transaction.amount > 0 ? 'text-primary' : 'text-red-500'
                                            }`}>
                                            {transaction.amount > 0 ? '+' : ''}₪{Math.abs(transaction.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OfficerDashboard;
