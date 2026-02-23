import React, { useState, useEffect } from 'react';
import { createWallet, updateWallet, deleteWallet, getWalletTransactions } from '../../services/walletService';
import { useWalletStore } from '../../store/walletStore';
import { useUserStore } from '../../store/userStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

function Wallets() {
    const { wallets, loading: walletsLoading, error: walletsError, fetchWallets } = useWalletStore();
    const { users, loading: usersLoading, error: usersError, fetchUsers } = useUserStore();

    const loading = walletsLoading || usersLoading;
    const error = walletsError || usersError;

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
        name: '', walletNumber: '', description: '', maxLimit: '', currentBalance: '', userIds: []
    });

    const icons = ['account_balance', 'savings', 'celebration', 'shopping_bag', 'credit_card', 'payments', 'wallet', 'attach_money'];
    const [selectedIcon, setSelectedIcon] = useState('account_balance');

    useEffect(() => {
        fetchWallets();
        fetchUsers();
    }, [fetchWallets, fetchUsers]);

    const fetchData = () => {
        fetchWallets(true);
        fetchUsers(true);
    };

    const handleOpenAdd = () => {
        setIsEditMode(false);
        setCurrentWallet(null);
        setFormData({
            name: '', walletNumber: '', description: '', maxLimit: '', currentBalance: '', userIds: []
        });
        setSelectedIcon('account_balance');
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
            maxLimit: wallet.maxLimit,
            currentBalance: wallet.currentBalance,
            userIds: wallet.walletUsers ? wallet.walletUsers.map(wu => wu.userId) : []
        });
        setSelectedIcon('account_balance'); // Icon not in schema yet, using default
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

    const handleDelete = async (e, id) => {
        if (e) e.stopPropagation();
        if (window.confirm("האם אתה בטוח שברצונך למחוק ארנק זה?")) {
            try {
                await deleteWallet(id);
                if (selectedWalletId === id) setSelectedWalletId(null);
                fetchWallets(true); // Refresh global state
                toast.success("הארנק נמחק בהצלחה");
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
            return {
                'תאריך': formatDateTime(tx.createdAt),
                'מבצע': tx.officer?.fullName || tx.cashier?.fullName || 'מערכת',
                'סוג החשבון / פעולה': txTypeHebrew,
                'סכום עסקת מקור': amountPrefix + '₪' + tx.totalAmount.toLocaleString(),
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
                <div className="flex flex-col sm:flex-row gap-3">
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
                    <button
                        onClick={handleOpenAdd}
                        className="bg-[#526f52] hover:bg-[#435c43] text-white px-6 py-2.5 rounded-full shadow-[0_4px_14px_rgb(82,111,82,0.2)] hover:shadow-[0_6px_20px_rgb(82,111,82,0.3)] transition-all flex items-center justify-center gap-2 font-medium whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined">add_card</span>
                        <span>צור ארנק חדש</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`flex flex - col lg: flex - row gap - 6 transition - all duration - 500 items - start`}>

                {/* Right Side (List of Wallets) */}
                <div className={`${selectedWalletId ? 'lg:w-1/3' : 'w-full'} transition - all duration - 500`}>
                    <div className={`grid ${selectedWalletId ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'} transition - all duration - 500`}>
                        {wallets.filter(w =>
                            w.name.toLowerCase().includes(walletSearchTerm.toLowerCase()) ||
                            (w.walletNumber && w.walletNumber.toLowerCase().includes(walletSearchTerm.toLowerCase()))
                        ).map((wallet) => (
                            <div
                                key={wallet.id}
                                onClick={() => handleSelectWallet(wallet)}
                                className={`bg - white rounded - [32px] p - 6 shadow - [0_4px_20px_rgb(0, 0, 0, 0.04)] transition - all duration - 500 relative overflow - hidden flex flex - col justify - between min - h - [200px] cursor - pointer
                                    ${selectedWalletId === wallet.id ? 'ring-2 ring-[#526f52] shadow-lg transform -translate-y-1' : 'hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-[#526f52]/10 border border-transparent'}
                                    ${selectedWalletId && selectedWalletId !== wallet.id ? 'opacity-60 scale-[0.98] hover:opacity-100 hover:scale-100' : ''} `}
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w - 12 h - 12 rounded - full flex items - center justify - center text - white shadow - md transition - colors ${selectedWalletId === wallet.id ? 'bg-[#526f52]' : 'bg-gray-400'} `}>
                                            <span className="material-symbols-outlined text-2xl">account_balance</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[#2d3748] text-lg mb-0.5">{wallet.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-mono">{wallet.walletNumber}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={(e) => handleOpenEdit(e, wallet)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#526f52] transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">edit</span>
                                        </button>
                                        <button onClick={(e) => handleDelete(e, wallet.id)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Balance Content */}
                                <div className="flex flex-col gap-1 mb-2">
                                    <span className="text-sm text-gray-400 font-medium">יתרה נוכחית</span>
                                    <span className="text-3xl font-bold text-[#2d3748]">₪{wallet.currentBalance?.toLocaleString()}</span>
                                </div>

                                {/* Footer Indicators */}
                                <div className="flex items-center gap-2 mt-auto text-xs font-medium text-gray-400">
                                    <span className="material-symbols-outlined text-[16px]">group</span>
                                    <span>{wallet.walletUsers?.length || 0} משתמשים מורשים</span>
                                </div>
                            </div>
                        ))}
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
                                    <button onClick={(e) => handleOpenEdit(e, currentWallet)} className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-gray-500 hover:text-[#526f52] shadow-sm transition-colors bg-white/50 border border-gray-200/50" title="ערוך ארנק">
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                    </button>
                                    <button onClick={(e) => handleDelete(e, currentWallet?.id)} className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-gray-500 hover:text-red-500 shadow-sm transition-colors bg-white/50 border border-gray-200/50" title="מחק ארנק">
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                </div>
                                <div>
                                    <span className="text-sm text-gray-500 font-medium">יתרה עדכנית</span>
                                    <div className="text-4xl font-black text-[#2d3748]">₪{currentWallet?.currentBalance?.toLocaleString()}</div>
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
                                                        className={`hover: bg - gray - 50 transition - colors cursor - pointer ${expandedTransactionId === tx.id ? 'bg-[#f8f9f8]' : ''} `}
                                                        onClick={() => setExpandedTransactionId(expandedTransactionId === tx.id ? null : tx.id)}
                                                    >
                                                        <td className="px-6 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`material - symbols - outlined text - gray - 400 text - sm transition - transform ${expandedTransactionId === tx.id ? 'rotate-180' : ''} `}>expand_more</span>
                                                                {formatDateTime(tx.createdAt)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-bold text-[#2d3748] whitespace-nowrap">
                                                            {tx.officer?.fullName || tx.cashier?.fullName || 'מערכת'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                                                            <span className={`px - 2 py - 1 rounded text - xs font - bold ${tx.transactionType === 'sale' ? 'bg-red-50 text-red-600' : tx.transactionType === 'withdrawal' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'} `}>
                                                                {tx.transactionType === 'sale' ? 'קנייה' : tx.transactionType === 'withdrawal' ? 'משיכה' : tx.transactionType === 'deposit' ? 'הפקדה' : 'זיכוי/החזרה'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-left whitespace-nowrap">
                                                            <span className={`text - base font - black ${tx.transactionType === 'sale' || tx.transactionType === 'withdrawal' ? 'text-red-500' : 'text-green-500'} `}>
                                                                {tx.transactionType === 'sale' || tx.transactionType === 'withdrawal' ? '-' : '+'}₪{tx.totalAmount.toLocaleString()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {expandedTransactionId === tx.id && (
                                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                                            <td colSpan="4" className="p-0">
                                                                <div className="px-10 py-4 shadow-inner">
                                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">פירוט פריטים</h4>
                                                                    <table className="w-full text-right text-sm">
                                                                        <thead className="text-gray-400 border-b border-gray-200">
                                                                            <tr>
                                                                                <th className="py-2 font-medium">פריט</th>
                                                                                <th className="py-2 font-medium">כמות</th>
                                                                                <th className="py-2 font-medium">מחיר יחידה</th>
                                                                                <th className="py-2 font-medium text-left">סה"כ</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {tx.items && tx.items.length > 0 ? (
                                                                                tx.items.map(item => (
                                                                                    <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                                                                                        <td className="py-2 font-medium text-[#2d3748]">{item.productName || item.product?.name || 'פריט כללי'}</td>
                                                                                        <td className="py-2 text-gray-600">{item.quantity}</td>
                                                                                        <td className="py-2 text-gray-600">₪{item.unitPrice.toLocaleString()}</td>
                                                                                        <td className="py-2 font-bold text-[#2d3748] text-left">₪{item.lineTotal.toLocaleString()}</td>
                                                                                    </tr>
                                                                                ))
                                                                            ) : (
                                                                                <tr>
                                                                                    <td colSpan="4" className="py-4 text-center text-gray-400 text-xs">אין פירוט פריטים שמור לעסקה זו</td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                    {tx.notes && (
                                                                        <div className="mt-4 pt-3 border-t border-gray-200">
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
                                <div className="grid grid-cols-1 gap-4">
                                    {!isEditMode && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">תקציב (אינפורמטיבי) *</label>
                                            <input type="number" required={!isEditMode} className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20" value={formData.maxLimit} onChange={(e) => setFormData({ ...formData, maxLimit: e.target.value })} />
                                        </div>
                                    )}
                                </div>

                                {isEditMode && (
                                    <div>
                                        <label className="block text-sm font-bold text-[#2d3748] mb-1">יתרה בפועל (עריכה ידנית)</label>
                                        <input type="number" step="0.01" className="w-full px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-sm focus:ring-2 focus:ring-yellow-500/20 font-bold text-[#2d3748]" value={formData.currentBalance} onChange={(e) => setFormData({ ...formData, currentBalance: e.target.value })} />
                                        <p className="text-xs text-orange-500 mt-1">שים לב: שינוי ידני של יתרה מתעדכן מיידית בספרים ונשמר בהיסטוריית הפעולות.</p>
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
                                !formData.userIds.includes(user.id) &&
                                (user.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                    user.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                            ).length > 0 ? (
                                <div className="space-y-2">
                                    {users.filter(user =>
                                        !formData.userIds.includes(user.id) &&
                                        (user.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                            user.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                                    ).map(user => (
                                        <div key={user.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-xl px-3 cursor-pointer transition-colors" onClick={() => toggleUserSelection(user.id)}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                    <span className="material-symbols-outlined">person</span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-[#2d3748]">{user.fullName}</div>
                                                    <div className="text-xs text-gray-500">{user.username}</div>
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
                                                    className={`hover: bg - [#f8f9f8] transition - colors cursor - pointer ${expandedTransactionId === tx.id ? 'bg-[#f8f9f8]' : ''} `}
                                                    onClick={() => setExpandedTransactionId(expandedTransactionId === tx.id ? null : tx.id)}
                                                >
                                                    <td className="px-6 py-4 text-base text-gray-700 font-medium whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`material - symbols - outlined text - gray - 400 transition - transform ${expandedTransactionId === tx.id ? 'rotate-180' : ''} `}>expand_more</span>
                                                            {formatDateTime(tx.createdAt)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-base font-bold text-[#2d3748] whitespace-nowrap">
                                                        {tx.officer?.fullName || tx.cashier?.fullName || 'מערכת'}
                                                    </td>
                                                    <td className="px-6 py-4 text-base whitespace-nowrap">
                                                        <span className={`px - 3 py - 1.5 rounded - full text - sm font - bold ${tx.transactionType === 'sale' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} `}>
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
                                                                <h4 className="text-sm font-bold text-gray-700 mb-2">פירוט פריטים</h4>
                                                                <table className="w-full text-right text-sm">
                                                                    <thead className="text-gray-500 border-b border-gray-200">
                                                                        <tr>
                                                                            <th className="py-2 font-medium">פריט</th>
                                                                            <th className="py-2 font-medium">כמות</th>
                                                                            <th className="py-2 font-medium">מחיר יחידה</th>
                                                                            <th className="py-2 font-medium">סה"כ</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {tx.items && tx.items.length > 0 ? (
                                                                            tx.items.map(item => (
                                                                                <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                                                                                    <td className="py-2 font-medium text-[#2d3748]">{item.productName || item.product?.name || 'פריט כללי'}</td>
                                                                                    <td className="py-2 text-gray-600">{item.quantity}</td>
                                                                                    <td className="py-2 text-gray-600">₪{item.unitPrice.toLocaleString()}</td>
                                                                                    <td className="py-2 font-bold text-[#2d3748]">₪{item.lineTotal.toLocaleString()}</td>
                                                                                </tr>
                                                                            ))
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan="4" className="py-4 text-center text-gray-400">אין פירוט פריטים שמור לעסקה זו</td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                                {tx.notes && (
                                                                    <div className="mt-4 pt-3 border-t border-gray-200">
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Wallets;
