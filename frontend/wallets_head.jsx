import React, { useState, useEffect, useRef } from 'react';
import { createWallet, updateWallet, deleteWallet, getWalletTransactions } from '../../services/walletService';
import { getForceActiveMessage } from '../../services/messageService';
import { getDashboardStats } from '../../services/dashboardService';
import { socket } from '../../services/socketService';
import { useWalletStore } from '../../store/walletStore';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useCategoryStore } from '../../store/categoryStore';
import { createCategory } from '../../services/categoryService';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

function Wallets() {
    const { wallets, loading: walletsLoading, error: walletsError, fetchWallets } = useWalletStore();
    const { users, loading: usersLoading, error: usersError, fetchUsers } = useUserStore();
    const { user: currentUser } = useAuthStore();
    const { categories: apiCategories, fetchCategories } = useCategoryStore();

    // loading state and console.logs
    console.log(wallets);

    const loading = walletsLoading || (currentUser?.role === 'admin' && usersLoading);
    const error = walletsError || (currentUser?.role === 'admin' && usersError);
    
    // System Mode Detection
    const hasWallets = wallets?.length > 0;
    const systemMode = !hasWallets ? 'none' : (wallets[0].categoryBalances?.length > 0 ? 'categories' : 'general');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentWallet, setCurrentWallet] = useState(null);
    const [walletTransactions, setWalletTransactions] = useState([]);
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [expandedTransactionId, setExpandedTransactionId] = useState(null);

    const [walletSearchTerm, setWalletSearchTerm] = useState('');
    const [selectedWalletId, setSelectedWalletId] = useState(null);
    const [inlineHistoryLoading, setInlineHistoryLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '', walletNumber: '', description: '', categories: [], generalBalance: '', notes: '', userIds: []
    });

    const [activeModalTab, setActiveModalTab] = useState('general');
    const [tabWarning, setTabWarning] = useState(false);

    const triggerTabWarning = () => {
        setTabWarning(true);
        setTimeout(() => setTabWarning(false), 3000);
    };

    const [selectedCategoryName, setSelectedCategoryName] = useState('');
    const [categoryBalanceInput, setCategoryBalanceInput] = useState('');
    const [editingCategoryIdx, setEditingCategoryIdx] = useState(null);
    const [editCategoryValue, setEditCategoryValue] = useState('');
    const [showMoreCatsWalletId, setShowMoreCatsWalletId] = useState(null);
    const [showMoreCatsHistory, setShowMoreCatsHistory] = useState(false);


    const icons = ['account_balance', 'savings', 'celebration', 'shopping_bag', 'credit_card', 'payments', 'wallet', 'attach_money', 'storefront', 'paid'];
    const [selectedIcon, setSelectedIcon] = useState('account_balance');

    // Notifications State
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notificationSearchTerm, setNotificationSearchTerm] = useState('');
    const notificationsRef = useRef(null);

    // System Message viewing State
    const [isSystemMessageOpen, setIsSystemMessageOpen] = useState(false);
    const [currentSystemMessage, setCurrentSystemMessage] = useState(null);

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

    useEffect(() => {
        fetchWallets();
        fetchCategories();
        if (currentUser?.role === 'admin') {
            fetchUsers();
        }
    }, [fetchWallets, fetchCategories, fetchUsers, currentUser?.role]);

    // Auto-select the first wallet for officers when the list loads
    useEffect(() => {
        if (currentUser?.role === 'officer' && wallets?.length > 0 && !selectedWalletId && !loading) {
            handleSelectWallet(wallets[0]);
        }
    }, [wallets, currentUser?.role, selectedWalletId, loading]);

    const fetchData = () => {
        fetchWallets(true);
        if (currentUser?.role === 'admin') {
            fetchUsers(true);
        }
    };

    const handleOpenAdd = () => {
        setIsEditMode(false);
        setCurrentWallet(null);
        setFormData({
            name: '', walletNumber: '', description: '', categories: [], generalBalance: '', notes: '', userIds: []
        });
        setSelectedCategoryName('');
        setCategoryBalanceInput('');
        setSelectedIcon('account_balance');
        setActiveModalTab(systemMode === 'none' ? 'general' : systemMode);
        setIsModalOpen(true);
    };

    const handleOpenAddUser = () => {
        setUserSearchTerm('');
        setIsAddUserModalOpen(true);
    };

    const handleOpenEdit = (e, wallet) => {
        if (e) e.stopPropagation();
        setIsEditMode(true);
        setCurrentWallet(wallet);
        // Extract user IDs from walletUsers if available, need to fetch detailed wallet or check if list has it
        // The list endpoint includes count, but logic might need detailed fetch or pass assignments
        // For now assume we might need to fetch details or if list has it. 
        // Let's rely on what we have or fetch detail. 
        // Actually the Grid doesn't show users, so 'wallets' might not have them.
        // I'll fetch full wallet details on open edit to be safe.
        // For simplicity in this step, I'll filter 'users' if I can, but let's just prefill with empty for now 
        // and ideally fetch real assignments.

        // Quick fix: fetch wallet details
        // But to be fast, let's just set basic info and if user edits users, they select new ones.
        // Better: Fetch details.
        setFormData({
            name: wallet.name,
            walletNumber: wallet.walletNumber || '',
            description: wallet.description || '',
            categories: wallet.categoryBalances ? [...wallet.categoryBalances] : [],
            generalBalance: (!wallet.categoryBalances || wallet.categoryBalances.length === 0) ? wallet.currentBalance : '',
            notes: '',
            userIds: wallet.walletUsers ? wallet.walletUsers.map(wu => wu.userId) : []
        });
        setSelectedCategoryName('');
        setCategoryBalanceInput('');
        setSelectedIcon('account_balance'); // Icon not in schema yet, using default
        setActiveModalTab((wallet.categoryBalances && wallet.categoryBalances.length > 0) ? 'categories' : 'general');
        setIsModalOpen(true);
    };

    const handleOpenHistory = async (wallet) => {
        setCurrentWallet(wallet);
        setHistorySearchTerm('');
        try {
            const txs = await getWalletTransactions(wallet.id);
            setWalletTransactions(txs);
            setExpandedTransactionId(null);
            setIsHistoryModalOpen(true);
        } catch (err) {
            toast.error("שגיאה בטעינת היסטוריה");
        }
    };

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

    const handleDelete = async (e, id) => {
        if (e) e.stopPropagation();
        const isLastWallet = wallets.length === 1 && wallets[0].id === id;
        const confirmMsg = isLastWallet
            ? "⚠️ זהו הארנק האחרון במערכת!\n\nמחיקתו תגרום לאיפוס מלא של המערכת:\n• כל הקטגוריות ימחקו\n• כל המוצרים יקבלו קטגוריה 'ללא קטגוריה'\n• ניתן יהיה לבחור מחדש את סוג הארנק (כללי / מחולק לקטגוריות)\n\nהאם אתה בטוח שברצונך למחוק?"
            : "האם אתה בטוח שברצונך למחוק ארנק זה?";

        if (window.confirm(confirmMsg)) {
            try {
                await deleteWallet(id);
                if (selectedWalletId === id) setSelectedWalletId(null);
                fetchWallets(true); // Refresh global state
                if (isLastWallet) {
                    toast.success("המערכת אופסה. כל הארנקים והקטגוריות נמחקו.");
                } else {
                    toast.success("הארנק נמחק בהצלחה");
                }
            } catch (err) {
                toast.error("שגיאה במחיקת ארנק");
            }
        }
    };

    const handleSelectWallet = async (wallet) => {
        if (selectedWalletId === wallet.id) {
            setSelectedWalletId(null);
            return;
        }
        setSelectedWalletId(wallet.id);
        setCurrentWallet(wallet);
        setHistorySearchTerm('');
        setShowMoreCatsHistory(false);
        setShowMoreCatsWalletId(null);
        setInlineHistoryLoading(true);
        try {
            const txs = await getWalletTransactions(wallet.id);
            setWalletTransactions(txs);
            setExpandedTransactionId(null);
        } catch (err) {
            toast.error("שגיאה בטעינת היסטוריה");
        } finally {
            setInlineHistoryLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSave = {
                ...formData,
                // userId mapping handled by backend expects array of strings
                userIds: formData.userIds
            };

            if (isEditMode) {
                await updateWallet(currentWallet.id, dataToSave);
            } else {
                await createWallet(dataToSave);
            }
            fetchWallets(true); // Refresh global list
            setIsModalOpen(false);
            toast.success("נשמר בהצלחה");
        } catch (err) {
            toast.error("שגיאה בשמירה: " + (err.response?.data?.error || err.message));
        }
    };

    const toggleUserSelection = (userId) => {
        const currentIds = formData.userIds;
        if (currentIds.includes(userId)) {
            setFormData({ ...formData, userIds: currentIds.filter(id => id !== userId) });
        } else {
            setFormData({ ...formData, userIds: [...currentIds, userId] });
        }
    };

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
                    <p className="text-gray-600">{error}</p>
                    <button
                        onClick={fetchData}
                        className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        נסה שוב
                    </button>
                </div>
            </div>
        );
    }

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const handleExportToExcel = (e) => {
        if (e) e.stopPropagation();

        // Use the same filtered data that is currently rendered
        const filteredTransactions = walletTransactions.filter(tx => {
            const searchTerm = historySearchTerm.toLowerCase();
            if (!searchTerm) return true;
            const dateStr = formatDateTime(tx.createdAt).toLowerCase();
            const userName = (tx.officer?.fullName || tx.cashier?.fullName || 'מערכת').toLowerCase();
            const typeStr = (tx.transactionType === 'sale' ? 'קנייה' : 'זיכוי/החזרה').toLowerCase();
            const amountStr = tx.totalAmount.toString().toLowerCase();
            return dateStr.includes(searchTerm) || userName.includes(searchTerm) || typeStr.includes(searchTerm) || amountStr.includes(searchTerm);
        });

        if (filteredTransactions.length === 0) {
            toast.error("אין נתונים לייצוא");
            return;
        }

        const exportData = filteredTransactions.map(tx => {
            const txTypeHebrew = tx.transactionType === 'sale' ? 'קנייה' :
                tx.transactionType === 'withdrawal' ? 'משיכה' :
                    tx.transactionType === 'deposit' ? 'הפקדה' : 'זיכוי/החזרה';
            const amountPrefix = (tx.transactionType === 'sale' || tx.transactionType === 'withdrawal') ? '-' : '+';
            
            // Generate category breakdown for export
            let categoryBreakdown = '';
            if (tx.items && tx.items.length > 0) {
                const catTotals = {};
                tx.items.forEach(item => {
                    if (item.categoryName) {
                        catTotals[item.categoryName] = (catTotals[item.categoryName] || 0) + item.lineTotal;
                    }
                });
                if (Object.keys(catTotals).length > 0) {
                    categoryBreakdown = Object.entries(catTotals).map(([cat, total]) => `${cat}: ₪${total}`).join(' | ');
                }
            }

            return {
                'תאריך': formatDateTime(tx.createdAt),
                'מבצע': tx.officer?.fullName || tx.cashier?.fullName || 'מערכת',
                'סוג החשבון / פעולה': txTypeHebrew,
                'סכום עסקת מקור': amountPrefix + '₪' + tx.totalAmount.toLocaleString(),
                'פירוט קטגוריות': categoryBreakdown,
                'הערות (סיבת העברה/זיכוי/שונות)': tx.notes || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);

        // Set column widths
        const colWidths = [
            { wch: 20 }, // תאריך
            { wch: 25 }, // מבצע
            { wch: 20 }, // סוג
            { wch: 15 }, // סכום
            { wch: 30 }, // קטגוריות
            { wch: 40 }  // הערות
        ];
        ws['!cols'] = colWidths;

        // Make header RTL and style it
        ws['!dir'] = 'rtl';

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "היסטוריית ארנק");

        const fileName = `ארנק_${currentWallet?.name || 'נתונים'}_${formatDateTime(new Date()).replace(/[/\\:, ]/g, '_')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="space-y-8 pb-20 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#2d3748]">ניהול תקציבים</h1>
                    <p className="text-[#a0aec0] text-sm mt-1">צפה ונהל את ארנקי היחידה</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                            <input
                                type="text"
                                placeholder="חפש ארנק (שם או מספר)..."
                                value={walletSearchTerm}
                                onChange={(e) => setWalletSearchTerm(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-full py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#526f52]/20 focus:border-[#526f52] transition-all shadow-sm"
                            />
                        </div>
                        {currentUser?.role === 'admin' && (
                            <button
                                onClick={handleOpenAdd}
                                className="bg-[#526f52] hover:bg-[#435c43] text-white px-6 py-2.5 rounded-full shadow-[0_4px_14px_rgb(82,111,82,0.2)] hover:shadow-[0_6px_20px_rgb(82,111,82,0.3)] transition-all flex items-center justify-center gap-2 font-medium whitespace-nowrap"
                            >
                                <span className="material-symbols-outlined">add_card</span>
                                <span className="hidden sm:inline">צור ארנק חדש</span>
                            </button>
                        )}

                        {/* System Message Button (Officer Only) */}
                        {currentUser?.role === 'officer' && (
                            <button
                                onClick={handleOpenSystemMessage}
                                className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow group border border-gray-200 shrink-0"
                                title="צפייה בהודעת מערכת פעילה"
                            >
                                <span className="material-symbols-outlined text-[#526f52] group-hover:text-[#435c43] transition-colors">
                                    campaign
                                </span>
                            </button>
                        )}

                        {/* Notifications */}
                        <div className="relative" ref={notificationsRef}>
                            <button
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow group border border-gray-200 shrink-0"
                            >
                                <span className="material-symbols-outlined text-[#526f52] group-hover:text-[#435c43] transition-colors">
                                    notifications
                                </span>
                                {lowStockProducts.length > 0 && (
                                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {isNotificationsOpen && (
                                <div className="absolute top-12 left-0 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col z-50 animate-fade-in-up">
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
                                            <div className="p-6 text-center text-gray-400 text-sm">אין התראות מלאי כרגע</div>
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
                    </div>
                </div>
            </div>


            {/* Main Content Area */}
            <div className={`flex flex-col lg:flex-row gap-6 transition-all duration-500 items-start`}>
                {console.log(walletSearchTerm)}
                {/* Right Side (List of Wallets) */}
                <div className={`${selectedWalletId ? 'lg:w-1/3' : 'w-full'} transition-all duration-500`}>
                    <div className={`grid ${selectedWalletId ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'} transition-all duration-500`}>
                        {wallets.filter(w => {
                            if (!walletSearchTerm) return true;
                            const search = walletSearchTerm.toLowerCase();
                            return (w.name?.toLowerCase().includes(search) || w.walletNumber?.includes(search) || w.id.includes(search));
                        }).map((wallet, index) => {
                            const colors = ['bg-blue-400', 'bg-orange-400', 'bg-purple-400', 'bg-pink-400', 'bg-teal-400', 'bg-indigo-400', 'bg-yellow-400'];
                            const bgColor = colors[index % colors.length];
                            return (
                                <div
                                    key={wallet.id}
                                    onClick={() => handleSelectWallet(wallet)}
                                    className={`bg-white rounded-[32px] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] transition-all duration-500 relative overflow-hidden flex flex-col justify-between min-h-[200px] cursor-pointer
                                    ${selectedWalletId === wallet.id ? 'ring-2 ring-[#526f52] shadow-lg transform -translate-y-1' : 'hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-[#526f52]/10 border border-transparent'}
                                    ${selectedWalletId && selectedWalletId !== wallet.id ? 'opacity-60 scale-[0.98] hover:opacity-100 hover:scale-100' : ''} `}
                                >

                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-colors ${selectedWalletId === wallet.id ? 'bg-[#526f52]' : bgColor} `}>
                                                <span className="material-symbols-outlined text-2xl">account_balance</span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-[#2d3748] text-lg mb-0.5">{wallet.name}</h3>
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-mono">{wallet.walletNumber}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {currentUser?.role === 'admin' && (
                                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={(e) => handleOpenEdit(e, wallet)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#526f52] transition-colors">
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button onClick={(e) => handleDelete(e, wallet.id)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Balance Content */}
                                    <div className="flex flex-col gap-1 mb-2">
                                        <span className="text-sm text-gray-400 font-medium">יתרה נוכחית</span>
                                        <span className="text-3xl font-black text-[#2d3748]">₪{wallet.currentBalance?.toLocaleString()}</span>
                                        
                                        {/* Category Chips - inline row */}
                                        {wallet.categoryBalances?.length > 0 && (() => {
                                            const MAX_VISIBLE = 7;
                                            const visible = wallet.categoryBalances.slice(0, MAX_VISIBLE);
                                            const overflow = wallet.categoryBalances.slice(MAX_VISIBLE);
                                            return (
                                                <div className="relative mt-2">
                                                    <div className="flex flex-row gap-1.5 flex-wrap">
                                                        {visible.map(cat => {
                                                            const catData = apiCategories.find(c => c.name === cat.categoryName);
                                                            const catColor = catData?.color || '#ffffff';
                                                            const isWhite = catColor === '#ffffff';
                                                            return (
                                                                <div
                                                                    key={cat.categoryName}
                                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                                                                    style={{
                                                                        backgroundColor: isWhite ? '#f3f4f6' : catColor + '22',
                                                                        color: isWhite ? '#555' : catColor,
                                                                        border: `1px solid ${isWhite ? '#e5e7eb' : catColor + '55'}`
                                                                    }}
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isWhite ? '#aaa' : catColor }}></span>
                                                                    <span>{cat.categoryName}</span>
                                                                    <span className="font-bold">₪{cat.balance?.toLocaleString()}</span>
                                                                </div>
                                                            );
                                                        })}
                                                        {overflow.length > 0 && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setShowMoreCatsWalletId(showMoreCatsWalletId === wallet.id ? null : wallet.id); }}
                                                                className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors border border-gray-200"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px]">more_horiz</span>
                                                                <span>+{overflow.length}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Overflow popup */}
                                                    {showMoreCatsWalletId === wallet.id && overflow.length > 0 && (
                                                        <div
                                                            className="absolute bottom-full mb-1 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50 min-w-[200px] max-w-[280px]"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <button onClick={() => setShowMoreCatsWalletId(null)} className="text-gray-400 hover:text-gray-700">
                                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                                </button>
                                                                <span className="text-[11px] font-bold text-gray-500">כל הקטגוריות</span>
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                {overflow.map(cat => {
                                                                    const catData = apiCategories.find(c => c.name === cat.categoryName);
                                                                    const catColor = catData?.color || '#ffffff';
                                                                    const isWhite = catColor === '#ffffff';
                                                                    return (
                                                                        <div key={cat.categoryName} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg" style={{ backgroundColor: isWhite ? '#f9fafb' : catColor + '15' }}>
                                                                            <span className="text-[11px] font-bold" style={{ color: isWhite ? '#555' : catColor }}>{cat.categoryName}</span>
                                                                            <span className="text-[11px] font-black text-[#526f52]">₪{cat.balance?.toLocaleString()}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Footer Indicators */}
                                    <div className="flex items-center justify-between mt-auto text-[10px] text-gray-400">
                                        <span className="flex items-center gap-1 font-medium">
                                            {wallet.categoryBalances?.length > 0
                                                ? <><span className="material-symbols-outlined text-[12px] text-[#526f52]">category</span><span className="text-[#526f52]">תקציב מחולק</span></>
                                                : <><span className="material-symbols-outlined text-[12px] text-blue-400">account_balance</span><span className="text-blue-400">תקציב כללי</span></>
                                            }
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">group</span>
                                            <span>{wallet.walletUsers?.length || 0} מורשים</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                    </div>
                </div>

                {/* Left Side (Inline History) */}
                {selectedWalletId && (
                    <div className="lg:w-2/3 w-full bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col overflow-hidden animate-fade-in-up border border-[#526f52]/10 sticky top-6 max-h-[calc(100vh-100px)]">
                        {/* Header Details */}
                        <div className="p-8 border-b border-gray-100 bg-[#526f52]/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg bg-[#526f52]">
                                    <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#2d3748]">{currentWallet?.name}</h2>
                                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                        מספר ארנק: <span className="font-mono bg-white px-2 py-0.5 rounded shadow-sm">{currentWallet?.walletNumber}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-3 text-right">
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={handleExportToExcel} className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-gray-500 hover:text-green-600 shadow-sm transition-colors bg-white/50 border border-gray-200/50" title="ייצא לאקסל">
                                        <span className="material-symbols-outlined text-[20px]">download</span>
                                    </button>
                                    {currentUser?.role === 'admin' && (
                                        <>
                                            <button onClick={(e) => handleOpenEdit(e, currentWallet)} className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-gray-500 hover:text-[#526f52] shadow-sm transition-colors bg-white/50 border border-gray-200/50" title="ערוך ארנק">
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                            <button onClick={(e) => handleDelete(e, currentWallet?.id)} className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-gray-500 hover:text-red-500 shadow-sm transition-colors bg-white/50 border border-gray-200/50" title="מחק ארנק">
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-sm text-gray-500 font-medium">יתרה עדכנית כוללת</span>
                                    <div className="text-4xl font-black text-[#2d3748]">₪{currentWallet?.currentBalance?.toLocaleString()}</div>
                                    
                                    {currentWallet?.categoryBalances?.length > 0 && (() => {
                                        const MAX_VISIBLE = 7;
                                        const allCats = currentWallet.categoryBalances;
                                        const visible = allCats.slice(0, MAX_VISIBLE);
                                        const overflow = allCats.slice(MAX_VISIBLE);
                                        return (
                                            <div className="relative mt-2">
                                                <div className="flex flex-row gap-1.5 flex-wrap justify-end">
                                                    {visible.map(cat => {
                                                        const catData = apiCategories.find(c => c.name === cat.categoryName);
                                                        const catColor = catData?.color || '#ffffff';
                                                        const isWhite = catColor === '#ffffff';
                                                        return (
                                                            <div
                                                                key={cat.categoryName}
                                                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                                                                style={{
                                                                    backgroundColor: isWhite ? '#f3f4f6' : catColor + '22',
                                                                    color: isWhite ? '#555' : catColor,
                                                                    border: `1px solid ${isWhite ? '#e5e7eb' : catColor + '55'}`
                                                                }}
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isWhite ? '#aaa' : catColor }}></span>
                                                                <span>{cat.categoryName}</span>
                                                                <span className="font-bold">₪{cat.balance?.toLocaleString()}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {overflow.length > 0 && (
                                                        <button
                                                            onClick={() => setShowMoreCatsHistory(!showMoreCatsHistory)}
                                                            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors border border-gray-200"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">more_horiz</span>
                                                            <span>+{overflow.length}</span>
                                                        </button>
                                                    )}
                                                </div>
                                                {showMoreCatsHistory && overflow.length > 0 && (
                                                    <div className="absolute bottom-full mb-1 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50 min-w-[200px] max-w-[300px]">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <button onClick={() => setShowMoreCatsHistory(false)} className="text-gray-400 hover:text-gray-700">
                                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                                            </button>
                                                            <span className="text-[11px] font-bold text-gray-500">כל הקטגוריות</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            {overflow.map(cat => {
                                                                const catData = apiCategories.find(c => c.name === cat.categoryName);
                                                                const catColor = catData?.color || '#ffffff';
                                                                const isWhite = catColor === '#ffffff';
                                                                return (
                                                                    <div key={cat.categoryName} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg" style={{ backgroundColor: isWhite ? '#f9fafb' : catColor + '15' }}>
                                                                        <span className="text-[11px] font-bold" style={{ color: isWhite ? '#555' : catColor }}>{cat.categoryName}</span>
                                                                        <span className="text-[11px] font-black text-[#526f52]">₪{cat.balance?.toLocaleString()}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Search History */}
                        <div className="px-8 py-4 border-b border-gray-100 bg-white">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-bold text-[#2d3748] whitespace-nowrap">היסטוריית פעולות</h3>
                                <div className="relative flex-1">
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                                    <input
                                        type="text"
                                        placeholder="חפש תאריך, פעילי, או סכום..."
                                        value={historySearchTerm}
                                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                                        className="w-full bg-gray-50 border-none rounded-full py-2 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#526f52]/20 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* History Table */}
                        <div className="overflow-y-auto custom-scrollbar flex-1 relative bg-white">
                            {inlineHistoryLoading ? (
                                <div className="p-12 flex justify-center"><LoadingSpinner /></div>
                            ) : (
                                <table className="w-full text-right">
                                    <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10">
                                        <tr className="text-xs text-gray-500 uppercase tracking-wider">
                                            <th className="px-6 py-3 font-bold">תאריך</th>
                                            <th className="px-6 py-3 font-bold">מבצע</th>
                                            <th className="px-6 py-3 font-bold">סוג</th>
                                            <th className="px-6 py-3 font-bold text-left">סכום</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {walletTransactions
                                            .filter(tx => {
                                                const searchTerm = historySearchTerm.toLowerCase();
                                                if (!searchTerm) return true;
                                                const dateStr = formatDateTime(tx.createdAt).toLowerCase();
                                                const userName = (tx.officer?.fullName || tx.cashier?.fullName || 'מערכת').toLowerCase();
                                                const typeStr = (tx.transactionType === 'sale' ? 'קנייה' : 'זיכוי/החזרה').toLowerCase();
                                                const amountStr = tx.totalAmount.toString().toLowerCase();
                                                return dateStr.includes(searchTerm) || userName.includes(searchTerm) || typeStr.includes(searchTerm) || amountStr.includes(searchTerm);
                                            })
                                            .map(tx => (
                                                <React.Fragment key={tx.id}>
                                                    <tr
                                                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedTransactionId === tx.id ? 'bg-[#f8f9f8]' : ''} `}
                                                        onClick={() => setExpandedTransactionId(expandedTransactionId === tx.id ? null : tx.id)}
                                                    >
                                                        <td className="px-6 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`material-symbols-outlined text-gray-400 text-sm transition-transform ${expandedTransactionId === tx.id ? 'rotate-180' : ''} `}>expand_more</span>
                                                                {formatDateTime(tx.createdAt)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-bold text-[#2d3748] whitespace-nowrap">
                                                            {tx.officer?.fullName || tx.cashier?.fullName || 'מערכת'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${tx.transactionType === 'sale' ? 'bg-red-50 text-red-600' : tx.transactionType === 'withdrawal' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'} `}>
                                                                {tx.transactionType === 'sale' ? 'קנייה' : tx.transactionType === 'withdrawal' ? 'משיכה' : tx.transactionType === 'deposit' ? 'הפקדה' : 'זיכוי/החזרה'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-left whitespace-nowrap">
                                                            <span className={`text-base font-black ${tx.transactionType === 'sale' || tx.transactionType === 'withdrawal' ? 'text-red-500' : 'text-green-500'} `}>
                                                                {tx.transactionType === 'sale' || tx.transactionType === 'withdrawal' ? '-' : '+'}₪{tx.totalAmount.toLocaleString()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {expandedTransactionId === tx.id && (
                                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                                            <td colSpan="4" className="p-0">
                                                                <div className="px-10 py-4 shadow-inner">
                                                                    {tx.items && tx.items.length > 0 && (() => {
                                                                        const catTotals = {};
                                                                        tx.items.forEach(item => {
                                                                            if (item.categoryName) {
                                                                                catTotals[item.categoryName] = (catTotals[item.categoryName] || 0) + item.lineTotal;
                                                                            }
                                                                        });
                                                                        return (
                                                                        <>
                                                                            <div className="flex items-center gap-4 mb-3">
                                                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">פירוט פריטים</h4>
                                                                                {Object.keys(catTotals).length > 0 && (
                                                                                    <div className="flex items-center gap-2 mr-2 border-r border-gray-300 pr-4">
                                                                                        {Object.entries(catTotals).map(([cat, total]) => (
                                                                                            <div key={cat} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                                                                                                <span className="text-[11px] font-bold text-gray-500">{cat}</span>
                                                                                                <span className="text-xs font-black text-[#526f52]">₪{total.toLocaleString()}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <table className="w-full text-right text-sm">
                                                                                <thead className="text-gray-400 border-b border-gray-200">
                                                                                    <tr>
                                                                                        <th className="py-2 font-medium">פריט</th>
                                                                                        <th className="py-2 font-medium">קטגוריה</th>
                                                                                        <th className="py-2 font-medium">כמות</th>
                                                                                        <th className="py-2 font-medium">מחיר יחידה</th>
                                                                                        <th className="py-2 font-medium text-left">סה"כ</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {tx.items.map((item, index) => (
                                                                                        <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                                                                                            <td className="py-2 font-medium text-[#2d3748]">{item.productName || item.product?.name || 'פריט כללי'}</td>
                                                                                            <td className="py-2 text-gray-500 font-medium">
                                                                                                {item.categoryName ? (
                                                                                                    <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">{item.categoryName}</span>
                                                                                                ) : '-'}
                                                                                            </td>
                                                                                            <td className="py-2 text-gray-600">{item.quantity}</td>
                                                                                            <td className="py-2 text-gray-600">₪{item.unitPrice.toLocaleString()}</td>
                                                                                            <td className="py-2 font-bold text-[#2d3748] text-left">₪{item.lineTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </>
                                                                        );
                                                                    })()}
                                                                    {tx.notes && (
                                                                        <div className={tx.items && tx.items.length > 0 ? "mt-4 pt-3 border-t border-gray-200" : ""}>
                                                                            <span className="text-xs font-bold text-gray-500">הערות:</span>
                                                                            <p className="text-sm text-gray-700 mt-1">{tx.notes}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        {(walletTransactions.length === 0 ||
                                            walletTransactions.filter(tx => {
                                                const searchTerm = historySearchTerm.toLowerCase();
                                                if (!searchTerm) return true;
                                                const dateStr = formatDateTime(tx.createdAt).toLowerCase();
                                                const userName = (tx.officer?.fullName || tx.cashier?.fullName || 'מערכת').toLowerCase();
                                                const typeStr = (tx.transactionType === 'sale' ? 'קנייה' : 'זיכוי/החזרה').toLowerCase();
                                                const amountStr = tx.totalAmount.toString().toLowerCase();
                                                return dateStr.includes(searchTerm) || userName.includes(searchTerm) || typeStr.includes(searchTerm) || amountStr.includes(searchTerm);
                                            }).length === 0) && (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history_off</span>
                                                        <p>{walletTransactions.length === 0 ? 'אין פעולות להצגה' : 'לא נמצאו תוצאות לחיפוש זה'}</p>
                                                    </td>
                                                </tr>
                                            )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-2xl font-bold text-[#2d3748]">{isEditMode ? 'עריכת ארנק' : 'יצירת ארנק חדש'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">שם הארנק *</label>
                                        <input type="text" required className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">מספר ארנק *</label>
                                        <input type="text" required className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20" value={formData.walletNumber} onChange={(e) => setFormData({ ...formData, walletNumber: e.target.value })} />
                                    </div>
                                </div>
                                <div className="mt-8">
                                    {wallets.length > 0 && (
                                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-700">
                                            <span className="material-symbols-outlined text-[20px]">lock</span>
                                            <span className="text-xs font-bold font-rubik">
                                                סוג התקציב נעול עבור המערכת (קיימים ארנקים פעילים). 
                                                מחק את כל הארנקים כדי לשנות את סוג התקציב הגלובלי.
                                            </span>
                                        </div>
                                    )}
                                    <div className={`p-1.5 bg-gray-100/80 rounded-[14px] flex items-center justify-between gap-1.5 mb-6 shadow-inner transition-all duration-300 ${tabWarning ? 'ring-2 ring-red-400 bg-red-50/50 scale-[1.02]' : ''}`}>
                                        <button
                                            type="button"
                                            disabled={systemMode === 'categories'}
                                            className={`relative flex-1 py-2 text-[13px] font-bold rounded-xl transition-all duration-300 ${activeModalTab === 'general' ? 'bg-white text-[#526f52] shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'} ${(formData.categories.length > 0 && activeModalTab !== 'general') || systemMode === 'categories' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={() => {
                                                if (systemMode === 'categories') {
                                                    toast.error('המערכת נעולה על מצב קטגוריות');
                                                    return;
                                                }
                                                if (formData.categories.length > 0) {
                                                    triggerTabWarning();
                                                    toast.error('יש למחוק את תקציבי הקטגוריות על מנת לעבור לתקציב כללי');
                                                    return;
                                                }
                                                setActiveModalTab('general');
                                            }}
                                        >
                                            <span className="flex items-center justify-center gap-1.5 relative z-10">
                                                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                                                תקציב כללי משותף
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={systemMode === 'general'}
                                            className={`relative flex-1 py-2 text-[13px] font-bold rounded-xl transition-all duration-300 ${activeModalTab === 'categories' ? 'bg-white text-[#526f52] shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'} ${(formData.generalBalance !== '' && formData.generalBalance > 0 && activeModalTab !== 'categories') || systemMode === 'general' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={() => {
                                                if (systemMode === 'general') {
                                                    toast.error('המערכת נעולה על מצב תקציב כללי');
                                                    return;
                                                }
                                                if (formData.generalBalance !== '' && formData.generalBalance > 0) {
                                                    triggerTabWarning();
                                                    toast.error('יש למחוק את התקציב הכללי על מנת לעבור לקטגוריות');
                                                    return;
                                                }
                                                setActiveModalTab('categories');
                                            }}
                                        >
                                            <span className="flex items-center justify-center gap-1.5 relative z-10">
                                                <span className="material-symbols-outlined text-[18px]">category</span>
                                                תקציבים לפי קטגוריות
                                            </span>
                                        </button>
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 overflow-hidden relative">
                                        {activeModalTab === 'general' ? (
                                            <div className="animate-fade-in-up">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="font-bold text-[#2d3748]">הגדרת תקציב כולל (ללא חלוקה לקטגוריות)</h3>
                                                    {(formData.generalBalance !== '' && formData.generalBalance > 0) && (
                                                        <button type="button" onClick={() => setFormData({ ...formData, generalBalance: '' })} className="text-red-500 hover:text-red-700 text-sm flex items-center bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg shadow-sm border border-red-100 transition-colors">
                                                            <span className="material-symbols-outlined text-[18px] ml-1">delete</span>
                                                            מחק תקציב
                                                        </button>
                                                    )}
                                                </div>
                                                <div>
                                                    <input
                                                        type="number"
                                                        placeholder="הזן סכום כולל לתקציב הכללי (₪)..."
                                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-[#526f52]/20 transition-colors"
                                                        value={formData.generalBalance}
                                                        onChange={(e) => setFormData({ ...formData, generalBalance: e.target.value })}
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="animate-fade-in-up space-y-4">
                                                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                                    <h3 className="font-bold text-[#2d3748]">חלוקת תקציבים לפי קטגוריות</h3>
                                                    {formData.categories.length > 0 && (
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFormData(prev => ({ 
                                                                    ...prev, 
                                                                    categories: [],
                                                                    generalBalance: 0
                                                                }));
                                                                setActiveModalTab('general');
                                                                toast.success("כל הקטגוריות נוקו. התקציב הכללי אופס ל-0.");
                                                            }} 
                                                            className="text-red-500 hover:text-red-700 text-sm flex items-center bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg shadow-sm border border-red-100 transition-colors relative z-20 cursor-pointer"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px] ml-1">delete_sweep</span>
                                                            נקה הכל
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="הכנס שם קטגוריה חדשה או בחר..."
                                                            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                            value={selectedCategoryName}
                                                            onChange={(e) => setSelectedCategoryName(e.target.value)}
                                                            list="categories-list"
                                                        />
                                                        <datalist id="categories-list">
                                                            {apiCategories.map(cat => (
                                                                <option key={cat.id} value={cat.name} />
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                    <div className="w-full sm:w-36">
                                                        <input
                                                            type="number"
                                                            placeholder="תקציב (₪)"
                                                            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                            value={categoryBalanceInput}
                                                            onChange={(e) => setCategoryBalanceInput(e.target.value)}
                                                            min="0"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (!selectedCategoryName || !categoryBalanceInput) return;

                                                            const exists = apiCategories.find(c => c.name === selectedCategoryName);
                                                            if (!exists) {
                                                                try {
                                                                    await createCategory({ name: selectedCategoryName });
                                                                    await fetchCategories(true);
                                                                } catch (err) { }
                                                            }

                                                            setFormData(prev => {
                                                                const existingCat = prev.categories.findIndex(c => c.categoryName === selectedCategoryName);
                                                                const newCats = [...prev.categories];
                                                                if (existingCat > -1) {
                                                                    newCats[existingCat].balance += parseFloat(categoryBalanceInput);
                                                                } else {
                                                                    newCats.push({ categoryName: selectedCategoryName, balance: parseFloat(categoryBalanceInput) });
                                                                }
                                                                return { ...prev, categories: newCats };
                                                            });

                                                            setSelectedCategoryName('');
                                                            setCategoryBalanceInput('');
                                                        }}
                                                        className="px-6 py-2.5 bg-[#526f52] text-white rounded-xl hover:bg-[#435c43] text-sm font-bold shadow-sm transition-colors"
                                                    >
                                                        הוסף
                                                    </button>
                                                </div>

                                                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden text-sm">
                                                    {formData.categories.length === 0 ? (
                                                        <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                                                                <span className="material-symbols-outlined text-2xl opacity-50">category</span>
                                                            </div>
                                                            לא הוגדרו קטגוריות
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-gray-50/50">
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                {formData.categories.map((cat, idx) => (
                                                                    <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center relative group hover:border-[#526f52]/30 transition-all shadow-sm hover:shadow-md h-[110px]">
                                                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => { setEditingCategoryIdx(idx); setEditCategoryValue(cat.balance.toString()); }} 
                                                                                className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 hover:text-[#526f52] hover:bg-[#526f52]/10 flex items-center justify-center transition-colors"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                                                            </button>
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => setFormData(prev => ({ ...prev, categories: prev.categories.filter((_, i) => i !== idx) }))} 
                                                                                className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                                            </button>
                                                                        </div>
                                                                        
                                                                        <span className="text-gray-500 font-bold mb-2 text-sm text-center">{cat.categoryName}</span>
                                                                        
                                                                        {editingCategoryIdx === idx ? (
                                                                            <div className="flex bg-white items-center max-w-[90px] border border-[#526f52] rounded-lg overflow-hidden shadow-inner ring-2 ring-[#526f52]/10">
                                                                                <input 
                                                                                    type="number" 
                                                                                    className="w-full px-2 py-1 text-base outline-none font-black min-w-0 text-center text-[#2d3748]"
                                                                                    value={editCategoryValue}
                                                                                    onChange={(e) => setEditCategoryValue(e.target.value)}
                                                                                    autoFocus
                                                                                    min="0"
                                                                                    onBlur={() => {
                                                                                        const val = parseFloat(editCategoryValue);
                                                                                        if (!isNaN(val) && val >= 0) {
                                                                                            setFormData(prev => {
                                                                                                const newCats = [...prev.categories];
                                                                                                newCats[idx].balance = val;
                                                                                                return { ...prev, categories: newCats };
                                                                                            });
                                                                                        }
                                                                                        setEditingCategoryIdx(null);
                                                                                    }}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            e.preventDefault();
                                                                                            const val = parseFloat(editCategoryValue);
                                                                                            if (!isNaN(val) && val >= 0) {
                                                                                                setFormData(prev => {
                                                                                                    const newCats = [...prev.categories];
                                                                                                    newCats[idx].balance = val;
                                                                                                    return { ...prev, categories: newCats };
                                                                                                });
                                                                                            }
                                                                                            setEditingCategoryIdx(null);
                                                                                        } else if (e.key === 'Escape') {
                                                                                            setEditingCategoryIdx(null);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <div 
                                                                                className="text-xl font-black text-[#2d3748] cursor-pointer group-hover:text-[#526f52] transition-colors"
                                                                                onClick={() => {
                                                                                    setEditingCategoryIdx(idx);
                                                                                    setEditCategoryValue(cat.balance.toString());
                                                                                }}
                                                                            >
                                                                                ₪{cat.balance.toLocaleString()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="mt-4 bg-[#526f52]/5 rounded-xl px-5 py-4 border border-[#526f52]/10 flex justify-between items-center text-sm">
                                                                <span className="font-bold text-gray-700">סה"כ בארנק:</span>
                                                                <span className="font-black text-[#526f52] text-xl">₪{formData.categories.reduce((acc, cat) => acc + cat.balance, 0).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isEditMode && (
                                    <div className="space-y-4">
                                        <div className="animate-fade-in-up">
                                            <label className="block text-sm font-bold text-[#2d3748] mb-1">סיבת העדכון (יומחיש בהיסטוריה במקרה של שינוי)</label>
                                            <input type="text" placeholder="לדוגמה: הוספת תקציב למזון..." className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:ring-2 focus:ring-[#526f52]/20" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-gray-700">משתמשים אחראיים</label>
                                        <button
                                            type="button"
                                            onClick={handleOpenAddUser}
                                            className="text-sm font-bold text-[#526f52] hover:text-[#435c43] flex items-center gap-1 bg-[#526f52]/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-[#526f52]/20"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">person_add</span>
                                            הוסף משתמש
                                        </button>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar border border-gray-100 space-y-2">
                                        {users.filter(u => formData.userIds.includes(u.id)).length > 0 ? users.filter(u => formData.userIds.includes(u.id)).map(user => (
                                            <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-white rounded-lg px-3 transition-colors bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#526f52]/10 flex items-center justify-center text-[#526f52]">
                                                        <span className="material-symbols-outlined text-[16px]">person</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-[#2d3748]">{user.fullName}</div>
                                                        <div className="text-xs text-gray-500">{user.username}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUserSelection(user.id)}
                                                    className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                                                    title="הסר משתמש"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                </button>
                                            </div>
                                        )) : (
                                            <div className="text-center py-4 text-gray-400 text-sm">לא משויכים משתמשים לארנק זה</div>
                                        )}
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-[#526f52] hover:bg-[#435c43] text-white py-4 rounded-xl font-bold text-lg shadow-lg">
                                    {isEditMode ? 'שמור שינויים' : 'צור ארנק'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Add User Modal */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsAddUserModalOpen(false)}></div>
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="px-6 py-5 border-b border-gray-100 flex flex-col gap-4 bg-gray-50/50">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-[#2d3748]">שיוך משתמשים לחשבון</h2>
                                <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                            {/* User Search Box */}
                            <div className="relative">
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                                <input
                                    type="text"
                                    placeholder="חפש משתמש (שם או שם משתמש)..."
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pr-10 pl-4 text-xs focus:outline-none focus:ring-2 focus:ring-[#526f52]/10 focus:border-[#526f52] transition-all"
                                />
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {users.filter(user =>

                                user.role !== 'cashier' && user.role !== 'admin' &&
                                !formData.userIds.includes(user.id) &&
                                (user.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                    user.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                            ).length > 0 ? (
                                <div className="space-y-2">
                                    {users.filter(user =>
                                        user.role !== 'cashier' && user.role !== 'admin' &&
                                        !formData.userIds.includes(user.id) &&
                                        (user.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                            user.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                                    ).map(user => (
                                        <div key={user.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-xl px-3 cursor-pointer transition-colors" onClick={() => toggleUserSelection(user.id)}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                        <span className="material-symbols-outlined">person</span>
                                                    </div>
                                                    <div className="absolute bottom-0 right-0">
                                                        {user.isOnline ? (
                                                            <span className="block w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></span>
                                                        ) : (
                                                            <span className="block w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white"></span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-[#2d3748]">{user.fullName}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {user.isOnline ? <span className="text-green-600 font-medium text-[10px]">מחובר כעת</span> : <span className="text-[10px] text-gray-400">נראה לאחרונה: {formatDateTime(user.lastSeen)}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-[#526f52]/10 flex items-center justify-center text-[#526f52] hover:bg-[#526f52] hover:text-white transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">add</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">
                                        {userSearchTerm ? 'person_search' : 'group_off'}
                                    </span>
                                    <p className="text-sm">
                                        {userSearchTerm ? 'לא נמצאו משתמשים התואמים לחיפוש' : 'כל המשתמשים כבר משויכים לארנק זה'}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="w-full bg-[#526f52] hover:bg-[#435c43] text-white py-3 rounded-xl font-bold transition-colors">
                                סיום הוספה
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsHistoryModalOpen(false)}></div>
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-gray-100 flex flex-col gap-4 bg-gray-50/50">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-[#2d3748]">היסטוריית פעולות - {currentWallet?.name}</h2>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            {/* Search Box */}
                            <div className="relative">
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                                <input
                                    type="text"
                                    placeholder="חפש בהיסטוריה (תאריך, שם, סוג, סכום)..."
                                    value={historySearchTerm}
                                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-2xl py-3 pr-12 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#526f52]/20 focus:border-[#526f52] transition-all"
                                />
                            </div>
                        </div>
                        <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr className="text-sm text-gray-500 border-b border-gray-100">
                                        <th className="px-6 py-4 font-bold">תאריך</th>
                                        <th className="px-6 py-4 font-bold">מבצע הפעולה</th>
                                        <th className="px-6 py-4 font-bold">סוג</th>
                                        <th className="px-6 py-4 font-bold">סכום</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {walletTransactions
                                        .filter(tx => {
                                            const searchTerm = historySearchTerm.toLowerCase();
                                            if (!searchTerm) return true;

                                            const dateStr = formatDateTime(tx.createdAt).toLowerCase();
                                            const userName = (tx.officer?.fullName || tx.cashier?.fullName || 'מערכת').toLowerCase();
                                            const typeStr = (tx.transactionType === 'sale' ? 'קנייה' : 'זיכוי/החזרה').toLowerCase();
                                            const amountStr = tx.totalAmount.toString().toLowerCase();

                                            return dateStr.includes(searchTerm) ||
                                                userName.includes(searchTerm) ||
                                                typeStr.includes(searchTerm) ||
                                                amountStr.includes(searchTerm);
                                        })
                                        .map(tx => (
                                            <React.Fragment key={tx.id}>
                                                <tr
                                                    className={`hover:bg-[#f8f9f8] transition-colors cursor-pointer ${expandedTransactionId === tx.id ? 'bg-[#f8f9f8]' : ''} `}
                                                    onClick={() => setExpandedTransactionId(expandedTransactionId === tx.id ? null : tx.id)}
                                                >
                                                    <td className="px-6 py-4 text-base text-gray-700 font-medium whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`material-symbols-outlined text-gray-400 transition-transform ${expandedTransactionId === tx.id ? 'rotate-180' : ''} `}>expand_more</span>
                                                            {formatDateTime(tx.createdAt)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-base font-bold text-[#2d3748] whitespace-nowrap">
                                                        {tx.officer?.fullName || tx.cashier?.fullName || 'מערכת'}
                                                    </td>
                                                    <td className="px-6 py-4 text-base whitespace-nowrap">
                                                        <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${tx.transactionType === 'sale' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} `}>
                                                            {tx.transactionType === 'sale' ? 'קנייה' : 'זיכוי/החזרה'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-lg font-black text-[#2d3748] whitespace-nowrap">
                                                        ₪{tx.totalAmount.toLocaleString()}
                                                    </td>
                                                </tr>
                                                {expandedTransactionId === tx.id && (
                                                    <tr className="bg-gray-50 border-b border-gray-100">
                                                        <td colSpan="4" className="p-0">
                                                            <div className="px-12 py-4 bg-[#f8f9f8] shadow-inner">
                                                                {tx.items && tx.items.length > 0 && (() => {
                                                                    const catTotals = {};
                                                                    tx.items.forEach(item => {
                                                                        if (item.categoryName) {
                                                                            catTotals[item.categoryName] = (catTotals[item.categoryName] || 0) + item.lineTotal;
                                                                        }
                                                                    });
                                                                    return (
                                                                    <>
                                                                        <div className="flex items-center gap-4 mb-3">
                                                                            <h4 className="text-sm font-bold text-gray-700">פירוט פריטים</h4>
                                                                            {Object.keys(catTotals).length > 0 && (
                                                                                <div className="flex items-center gap-2 mr-2 border-r border-gray-300 pr-4">
                                                                                    {Object.entries(catTotals).map(([cat, total]) => (
                                                                                        <div key={cat} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                                                                                            <span className="text-[11px] font-bold text-gray-500">{cat}</span>
                                                                                            <span className="text-xs font-black text-[#526f52]">₪{total.toLocaleString()}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <table className="w-full text-right text-sm">
                                                                            <thead className="text-gray-500 border-b border-gray-200">
                                                                                <tr>
                                                                                    <th className="py-2 font-medium">פריט</th>
                                                                                    <th className="py-2 font-medium">קטגוריה</th>
                                                                                    <th className="py-2 font-medium">כמות</th>
                                                                                    <th className="py-2 font-medium">מחיר יחידה</th>
                                                                                    <th className="py-2 font-medium">סה"כ</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {tx.items.map((item, index) => (
                                                                                    <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                                                                                        <td className="py-2 font-medium text-[#2d3748]">
                                                                                            {item.productName || item.product?.name || 'פריט כללי'}
                                                                                        </td>
                                                                                        <td className="py-2 text-gray-500 font-medium">
                                                                                            {item.categoryName ? (
                                                                                                <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">{item.categoryName}</span>
                                                                                            ) : '-'}
                                                                                        </td>
                                                                                        <td className="py-2 text-gray-600">{item.quantity}</td>
                                                                                        <td className="py-2 text-gray-600">₪{item.unitPrice.toLocaleString()}</td>
                                                                                        <td className="py-2 font-bold text-[#2d3748]">₪{item.lineTotal.toLocaleString()}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </>
                                                                    );
                                                                })()}
                                                                {tx.notes && (
                                                                    <div className={tx.items && tx.items.length > 0 ? "mt-4 pt-3 border-t border-gray-200" : ""}>
                                                                        <span className="text-xs font-bold text-gray-500">הערות:</span>
                                                                        <p className="text-sm text-gray-700 mt-1">{tx.notes}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    {(walletTransactions.length === 0 ||
                                        walletTransactions.filter(tx => {
                                            const searchTerm = historySearchTerm.toLowerCase();
                                            if (!searchTerm) return true;
                                            const dateStr = formatDateTime(tx.createdAt).toLowerCase();
                                            const userName = (tx.officer?.fullName || tx.cashier?.fullName || 'מערכת').toLowerCase();
                                            const typeStr = (tx.transactionType === 'sale' ? 'קנייה' : 'זיכוי/החזרה').toLowerCase();
                                            const amountStr = tx.totalAmount.toString().toLowerCase();
                                            return dateStr.includes(searchTerm) || userName.includes(searchTerm) || typeStr.includes(searchTerm) || amountStr.includes(searchTerm);
                                        }).length === 0) && (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                                    {walletTransactions.length === 0 ? 'אין פעולות להצגה' : 'לא נמצאו תוצאות לחיפוש זה'}
                                                </td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                            {/* Spacing at the bottom of the list */}
                            <div className="h-24 w-full"></div>
                        </div>
                    </div>
                </div>
            )}
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
                                ההודעה פורסמה בתאריך: {formatDateTime(currentSystemMessage.createdAt)}
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

export default Wallets;
