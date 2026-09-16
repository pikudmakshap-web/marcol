import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getForceActiveMessage } from '../../services/messageService';
import { socket } from '../../services/socketService';
import api from '../../services/api';
import { useDashboardStore } from '../../store/dashboardStore';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnvironmentSwitcher from '../../components/EnvironmentSwitcher';
import toast from 'react-hot-toast';
import { toBackgroundRgba, toStrongSolidColor, isWhiteLikeColor } from '../../utils/categoryColor';

const DEFAULT_SYMBOL_IMAGE_URLS = [
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23ecfdf5'/%3E%3Cpath d='M14 29L32 17l18 12v19a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V29z' fill='%2316a34a'/%3E%3Crect x='27' y='36' width='10' height='14' rx='2' fill='%23dcfce7'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23eff6ff'/%3E%3Ccircle cx='24' cy='30' r='8' fill='%232563eb'/%3E%3Crect x='32' y='24' width='14' height='6' rx='3' fill='%231d4ed8'/%3E%3Crect x='34' y='32' width='10' height='5' rx='2.5' fill='%233b82f6'/%3E%3C/svg%3E"
];

function Dashboard() {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const { user: currentUser, refreshUser } = useAuthStore();
    const { dashboardData, loading, fetchDashboardStats } = useDashboardStore();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notificationSearchTerm, setNotificationSearchTerm] = useState('');
    const notificationsRef = useRef(null);
    const categoriesScrollRef = useRef(null);
    const hasMultipleEnvironments = (currentUser?.authorizedEnvironments?.length || 0) > 1;
    const [isEditingEnvironmentName, setIsEditingEnvironmentName] = useState(false);
    const [isEditingEnvironmentSymbols, setIsEditingEnvironmentSymbols] = useState(false);
    const [environmentBaseNameDraft, setEnvironmentBaseNameDraft] = useState('');
    const [environmentSymbolsDraft, setEnvironmentSymbolsDraft] = useState([]);
    const [savingEnvironmentName, setSavingEnvironmentName] = useState(false);
    const [showEnvironmentEditButtons, setShowEnvironmentEditButtons] = useState(false);
    const [environmentSymbolImages, setEnvironmentSymbolImages] = useState([]);
    const [environmentSymbolImagesDraft, setEnvironmentSymbolImagesDraft] = useState([]);
    const canAdminRenameEnvironment =
        (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && !!currentUser?.environmentId;
    const currentEnvironmentName =
        currentUser?.authorizedEnvironments?.find((env) => env.id === currentUser?.environmentId)?.name
        || currentUser?.environmentName
        || '';
    const currentEnvironment = currentUser?.authorizedEnvironments?.find((env) => env.id === currentUser?.environmentId);
    const displayedEnvironmentSymbolImages = environmentSymbolImages.length > 0
        ? environmentSymbolImages.slice(0, 4)
        : DEFAULT_SYMBOL_IMAGE_URLS;

    const countEmojiSymbols = (value) => {
        if (!value || typeof value !== 'string') return 0;
        const matches = value.match(/\p{Extended_Pictographic}/gu);
        return matches ? matches.length : 0;
    };

    const extractEnvironmentParts = (value) => {
        const raw = String(value || '');
        const symbols = raw.match(/\p{Extended_Pictographic}/gu) || [];
        const baseName = raw.replace(/\p{Extended_Pictographic}/gu, '').trim();
        return { baseName, symbols };
    };

    const { baseName: currentEnvironmentBaseName, symbols: currentEnvironmentSymbols } = extractEnvironmentParts(currentEnvironmentName);

    useEffect(() => {
        const serverImages = Array.isArray(currentEnvironment?.symbolImageUrls)
            ? currentEnvironment.symbolImageUrls.slice(0, 4)
            : [];
        setEnvironmentSymbolImages(serverImages);
    }, [currentEnvironment?.id, currentEnvironment?.symbolImageUrls]);

    const scrollCategories = (direction) => {
        if (categoriesScrollRef.current) {
            // Using standard left scroll amount
            const scrollAmount = direction === 'right' ? 300 : -300;
            categoriesScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

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
        // Force refetch on mount/environment change to avoid stale cross-environment cache
        fetchDashboardStats(true);

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
    }, [fetchDashboardStats, currentUser?.environmentId]);

    // Extract Data
    const { budget, inventoryValue, sales, wallets, topProducts, walletUsage, lowStockProducts, walletCategoryStats, lowestStockProducts, systemMode } = dashboardData;

    // Check if scroll arrows are needed simply based on the number of squares
    const showScrollArrows = systemMode === 'category'
        ? walletCategoryStats.length > 6
        : true; // In products mode, it always renders 10 squares, so > 6 is always true

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

    const startEditEnvironmentName = () => {
        if (!canAdminRenameEnvironment) return;
        setEnvironmentBaseNameDraft(currentEnvironmentBaseName || currentEnvironmentName || '');
        setIsEditingEnvironmentName(true);
    };

    const startEditEnvironmentSymbols = () => {
        if (!canAdminRenameEnvironment) return;
        setEnvironmentSymbolImagesDraft([...environmentSymbolImages]);
        setIsEditingEnvironmentSymbols(true);
    };

    const cancelEditEnvironmentName = () => {
        setIsEditingEnvironmentName(false);
        setEnvironmentBaseNameDraft('');
    };

    const cancelEditEnvironmentSymbols = () => {
        setIsEditingEnvironmentSymbols(false);
        setEnvironmentSymbolImagesDraft([]);
    };

    const handlePickEnvironmentSymbolFile = (index, file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('ניתן להעלות קובץ תמונה בלבד');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const imageDataUrl = String(reader.result || '');
            if (!imageDataUrl) return;
            setEnvironmentSymbolImagesDraft((prev) => {
                const next = [...prev];
                next[index] = imageDataUrl;
                return next.slice(0, 4);
            });
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveEnvironmentSymbol = (indexToRemove) => {
        setEnvironmentSymbolImagesDraft((prev) => {
            const next = [...prev];
            next[indexToRemove] = null;
            return next;
        });
    };

    const handleMoveEnvironmentSymbol = (index, direction) => {
        setEnvironmentSymbolImagesDraft((prev) => {
            const next = [...prev];
            const targetIndex = direction === 'left' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex > 3) return next;
            const currentValue = next[index] || null;
            const targetValue = next[targetIndex] || null;
            next[index] = targetValue;
            next[targetIndex] = currentValue;
            return next;
        });
    };

    const saveEnvironmentName = async () => {
        if (!canAdminRenameEnvironment) return;
        const nextBaseName = String(environmentBaseNameDraft || '').trim();
        const safeSymbols = (isEditingEnvironmentSymbols ? environmentSymbolsDraft : currentEnvironmentSymbols)
            .filter(Boolean)
            .slice(0, 4);
        const nextName = [nextBaseName, safeSymbols.join(' ')].filter(Boolean).join(' ').trim();

        if (!nextBaseName) {
            toast.error('שם סביבה הוא שדה חובה');
            return;
        }

        if (safeSymbols.length > 4 || countEmojiSymbols(safeSymbols.join('')) > 4) {
            toast.error('ניתן להוסיף עד 4 סמלים בשם הסביבה');
            return;
        }

        if (nextName === currentEnvironmentName) {
            cancelEditEnvironmentName();
            return;
        }

        setSavingEnvironmentName(true);
        try {
            await api.put(`/environments/${currentUser.environmentId}/display-name`, {
                name: nextName,
                symbolImageUrls: environmentSymbolImages
            });
            await refreshUser();
            toast.success('שם הסביבה עודכן בהצלחה');
            setIsEditingEnvironmentName(false);
        } catch (error) {
            toast.error(error.response?.data?.error || 'שגיאה בעדכון שם הסביבה');
        } finally {
            setSavingEnvironmentName(false);
        }
    };

    const saveEnvironmentSymbols = async () => {
        if (!canAdminRenameEnvironment) return;
        const safeImages = environmentSymbolImagesDraft.filter(Boolean).slice(0, 4);
        setSavingEnvironmentName(true);
        try {
            await api.put(`/environments/${currentUser.environmentId}/display-name`, {
                name: currentEnvironmentName,
                symbolImageUrls: safeImages
            });
            await refreshUser();
            setEnvironmentSymbolImages(safeImages);
            toast.success('סמלי הסביבה עודכנו בהצלחה');
            setIsEditingEnvironmentSymbols(false);
        } catch (error) {
            toast.error(error.response?.data?.error || 'שגיאה בעדכון סמלי הסביבה');
        } finally {
            setSavingEnvironmentName(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3rem)] max-w-[1920px] mx-auto overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between mb-3 shrink-0 relative z-[15000] min-h-[72px]">
                {/* Right Side: Environment, Notifications and Greeting */}
                <div className="flex items-center gap-6 pl-[700px]">
                    <div className="flex items-center gap-4 mr-2" data-tour="dashboard-env-switcher">
                        {/* Environment Switcher */}
                        <div className={hasMultipleEnvironments ? 'mr-0' : ''}>
                            <EnvironmentSwitcher />
                        </div>
                        {hasMultipleEnvironments && (
                            <div className="h-12 w-[2px] bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>
                        )}
                    </div>

                    {/* Notifications & Actions */}
                    <div className="flex items-center gap-3 relative" ref={notificationsRef} data-tour="dashboard-quick-actions">
                        {currentUser?.role === 'superadmin' && (
                            <button
                                onClick={() => navigate('/admin/environments')}
                                className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-[#526f52] hover:bg-gray-50 transition-colors shrink-0"
                                title="ניהול סביבות מערכת (מנהל על)"
                            >
                                <span className="material-symbols-outlined text-[20px]">lan</span>
                            </button>
                        )}
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

                {/* Left Side: Environment Compact Bar */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                    <div
                        className="group group/env-title w-[690px] h-[82px] rounded-2xl bg-transparent shadow-none px-2 flex items-center gap-4 overflow-hidden"
                        onMouseEnter={() => setShowEnvironmentEditButtons(true)}
                        onMouseLeave={() => setShowEnvironmentEditButtons(false)}
                    >
                        <div className="min-w-0 w-[180px] text-right shrink-0">
                            {canAdminRenameEnvironment && isEditingEnvironmentName ? (
                                <div className="flex items-center justify-end gap-2">
                                    <input
                                        value={environmentBaseNameDraft}
                                        autoFocus
                                        disabled={savingEnvironmentName}
                                        onChange={(e) => setEnvironmentBaseNameDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                saveEnvironmentName();
                                            }
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                cancelEditEnvironmentName();
                                            }
                                        }}
                                        className="text-[30px] font-black text-[#18294b] leading-none border-b-2 border-[#178a4a] bg-transparent focus:outline-none w-[140px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={saveEnvironmentName}
                                        className="w-8 h-8 rounded-lg bg-[#1f2e4a] text-white flex items-center justify-center"
                                        title="שמור שם"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">check</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-end gap-2">
                                    <div className="text-[30px] font-black text-[#18294b] leading-none truncate max-w-[140px]">
                                        {currentEnvironmentBaseName || 'Marcol'}
                                    </div>
                                    {canAdminRenameEnvironment && (
                                        <button
                                            type="button"
                                            onClick={startEditEnvironmentName}
                                            className="w-8 h-8 rounded-lg border border-slate-300 text-[#22314d] bg-white hover:bg-slate-50 items-center justify-center"
                                            style={{ display: showEnvironmentEditButtons ? 'flex' : 'none' }}
                                            title="עריכת שם"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="w-[2px] h-10 rounded-full bg-slate-200 shrink-0"></div>

                        <div className="inline-flex items-center gap-3 shrink-0 justify-end">
                            {isEditingEnvironmentSymbols
                                ? Array.from({ length: 4 }).map((_, index) => {
                                    const symbolImage = environmentSymbolImagesDraft[index] || '';
                                    return (
                                        <div key={`header-symbol-slot-${index}`} className="relative">
                                            <label className={`w-14 h-14 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden ${
                                                symbolImage
                                                    ? 'bg-transparent border-0'
                                                    : 'border-2 border-dashed border-[#b7c7de] text-[#8a99b0] hover:border-[#95accb] bg-[#f7f9fc]'
                                            }`}>
                                                {symbolImage ? (
                                                    <img src={symbolImage} alt={`symbol-${index + 1}`} className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-[9px] font-bold">הוסף</span>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handlePickEnvironmentSymbolFile(index, e.target.files?.[0])}
                                                />
                                            </label>
                                            {symbolImage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveEnvironmentSymbol(index)}
                                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center"
                                                        title="הסר סמל"
                                                    >
                                                        x
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveEnvironmentSymbol(index, 'left')}
                                                        disabled={index === 0}
                                                        className="absolute top-1 -left-2 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                                                        title="הזז שמאלה"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">chevron_left</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveEnvironmentSymbol(index, 'right')}
                                                        disabled={index === 3}
                                                        className="absolute bottom-1 -left-2 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                                                        title="הזז ימינה"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })
                                : displayedEnvironmentSymbolImages.map((imageSrc, index) => (
                                    <span key={`view-symbol-${index}`} className="w-14 h-14 flex items-center justify-center overflow-hidden">
                                        <img src={imageSrc} alt={`symbol-view-${index + 1}`} className="w-full h-full object-contain" />
                                    </span>
                                ))}
                            {canAdminRenameEnvironment && (
                                <button
                                    type="button"
                                    onClick={isEditingEnvironmentSymbols ? saveEnvironmentSymbols : startEditEnvironmentSymbols}
                                    className={`w-8 h-8 rounded-lg items-center justify-center ${isEditingEnvironmentSymbols ? 'bg-[#1f2e4a] text-white flex' : 'border border-slate-300 text-[#22314d] bg-white hover:bg-slate-50'}`}
                                    style={{ display: isEditingEnvironmentSymbols || showEnvironmentEditButtons ? 'flex' : 'none' }}
                                    title={isEditingEnvironmentSymbols ? 'שמור סמלים' : 'עריכת סמלים'}
                                >
                                    <span className="material-symbols-outlined text-[16px]">{isEditingEnvironmentSymbols ? 'check' : 'image'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Layout: Right Side (Widgets) vs Left Side (Content) */}
            <div className="flex-1 flex gap-6 min-h-0">

                {/* Right Column (Widgets) - Fixed Width */}
                <div className="w-[280px] flex flex-col gap-3 h-full shrink-0 mr-2" data-tour="dashboard-widgets-column">

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
                        <h3 className="text-sm font-bold text-[#2d3748] text-right mb-4 border-r-4 border-orange-400 pr-3 shrink-0">נמכרים ביותר</h3>
                        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto custom-scrollbar pr-1">
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
                <div className="flex-1 flex flex-col gap-5 h-full min-w-0">

                    {/* Main Bar Container - Glassmorphism style, extremely horizontal */}
                    <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white w-full flex flex-row items-center gap-6 shrink-0 z-50" data-tour="dashboard-main-stats">
                        {/* Fixed Left Section (in RTL, it's visually on the right) */}
                        <div className="flex flex-col gap-3 shrink-0 z-10 mr-2">
                            {/* Total Amount Card */}
                            <div className="h-[64px] w-[260px] bg-gradient-to-r from-[#22c55e] to-[#16a34a] rounded-[20px] px-4 flex items-center text-white relative overflow-hidden group/card border border-white/20">
                                <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-xl -translate-x-10 -translate-y-10"></div>
                                
                                <div className="flex-1 flex flex-col justify-center items-center text-center z-10 pl-2">
                                    <div className="text-white/95 text-[14px] font-bold mb-0.5">סכום כללי בארנקים</div>
                                    <div className="text-[22px] font-extrabold flex items-baseline gap-1" dir="ltr">
                                        {budget.current.toLocaleString()} <span className="text-[12px] font-black opacity-80">₪</span>
                                    </div>
                                </div>

                                <div className="relative z-10 bg-white/20 w-10 h-10 rounded-full flex items-center justify-center border border-white/30 shrink-0 shadow-inner">
                                    <span className="material-symbols-outlined text-[20px] text-white">account_balance_wallet</span>
                                </div>
                            </div>

                            {/* Inventory Value Card */}
                            <div className="h-[64px] w-[260px] bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-[20px] px-4 flex items-center text-white  relative overflow-hidden group/card border border-white/20">
                                <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-xl -translate-x-10 -translate-y-10"></div>
                                <div className="flex-1 flex flex-col justify-center items-center text-center z-10 pl-2">
                                    <div className="text-white/95 text-[14px] font-bold mb-0.5">סכום המלאי</div>
                                    <div className="text-[22px] font-extrabold flex items-baseline gap-1" dir="ltr">
                                        {inventoryValue ? inventoryValue.toLocaleString() : '0'} <span className="text-[12px] font-black opacity-80">₪</span>
                                    </div>
                                </div>

                                <div className="relative z-10 bg-white/20 w-10 h-10 rounded-full flex items-center justify-center border border-white/30 shrink-0 shadow-inner">
                                    <span className="material-symbols-outlined text-[20px] text-white">inventory_2</span>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-[120px] w-[1px] bg-gray-200 shrink-0 rounded-full mx-4 hidden sm:block"></div>

                        {/* Scrollable Categories Section */}
                        <div className="relative flex-1 min-w-0 group">
                            {/* Right scroll arrow */}
                            {showScrollArrows && (
                                <div className="absolute right-0 top-0 bottom-0 w-14 z-[100] group/right-arrow">
                                    <button
                                        onClick={() => scrollCategories('right')}
                                        className="absolute right-[-45px] top-1/2 -translate-y-1/2 w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-[#526f52] transition-all border border-gray-100 opacity-100 md:opacity-0 md:group-hover/right-arrow:opacity-100 hover:scale-110"
                                    >
                                        <span className="material-symbols-outlined text-[26px]">chevron_right</span>
                                    </button>
                                </div>
                            )}

                            {/* Scroll Container */}
                            <div ref={categoriesScrollRef} className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-row items-center gap-6 px-1 pt-12 pb-4 -mt-10 relative z-10 mask-edges">
                                {systemMode === 'category'
                                    ? (walletCategoryStats.length > 0
                                        ? walletCategoryStats.map((cat, idx) => {
                                            const solidColor = cat?.color ? toStrongSolidColor(cat.color, '#526f52') : '#526f52';

                                            return (
                                                <div
                                                    key={idx}
                                                    className="relative h-[100px] w-40 bg-white rounded-3xl p-4 flex flex-col justify-between border border-gray-100 hover:-translate-y-1 transition-all duration-300 cursor-default shrink-0 group/cat"
                                                    style={{ boxShadow: `0 8px 20px -4px ${toBackgroundRgba(solidColor, 0.25)}` }}
                                                >
                                                    {/* Tooltip */}
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover/cat:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                                        {cat.name}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-800"></div>
                                                    </div>

                                                    <div className="flex justify-between items-start w-full">
                                                        <span className="font-bold text-sm truncate max-w-[100px] text-right" style={{ color: solidColor }}>{cat.name}</span>
                                                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 opacity-80" style={{ backgroundColor: solidColor, boxShadow: `0 0 6px ${solidColor}` }}></div>
                                                    </div>

                                                    <div className="flex flex-col items-end w-full text-right mt-1">
                                                        <div className="text-[22px] font-extrabold flex items-baseline gap-1 leading-none" dir="ltr" style={{ color: solidColor }}>
                                                            {cat.totalBalance.toLocaleString()} <span className="text-[10px] font-bold opacity-60">₪</span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-medium mt-1">יתרה</div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                        : Array(3).fill(null).map((_, idx) => (
                                            <div
                                                key={idx}
                                                className="h-[100px] w-40 bg-transparent border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-300 shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-[24px]">category</span>
                                            </div>
                                        ))
                                    )
                                    : Array(10).fill(null).map((_, idx) => {
                                        const prod = lowestStockProducts[idx];
                                        const solidColor = !prod ? '#e5e7eb' : prod.quantity === 0 ? '#ef4444' : prod.quantity <= 3 ? '#f97316' : '#10b981';

                                        if (prod) {
                                            return (
                                                <div
                                                    key={idx}
                                                    className="relative h-[100px] w-40 bg-white rounded-3xl p-4 flex flex-col justify-between border border-gray-100 hover:-translate-y-1 transition-all duration-300 cursor-default shrink-0 group/prod"
                                                    style={{ boxShadow: `0 4px 7px -4px ${toBackgroundRgba(solidColor, 0.25)}` }}
                                                >
                                                    {/* Tooltip */}
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover/prod:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                                        {prod.name}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-800"></div>
                                                    </div>

                                                    <div className="flex justify-between items-start w-full gap-2">
                                                        <span className="font-bold text-sm truncate text-right flex-1" style={{ color: solidColor }}>{prod.name}</span>
                                                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 opacity-80" style={{ backgroundColor: solidColor, boxShadow: `0 0 6px ${solidColor}` }}></div>
                                                    </div>

                                                    <div className="flex flex-col items-end w-full text-right mt-1">
                                                        <div className="text-[22px] font-extrabold flex items-baseline gap-1 leading-none" style={{ color: solidColor }}>
                                                            {prod.quantity}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-medium mt-1">במלאי</div>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div
                                                    key={idx}
                                                    className="h-[100px] w-40 bg-transparent border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-300 shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                                                </div>
                                            );
                                        }
                                    })
                                }
                            </div>

                            {/* Left scroll arrow */}
                            {showScrollArrows && (
                                <div className="absolute left-[-20px] top-0 bottom-0 w-14 z-[100] group/left-arrow">
                                    <button
                                        onClick={() => scrollCategories('left')}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-[#526f52] transition-all border border-gray-100 opacity-100 md:opacity-0 md:group-hover/left-arrow:opacity-100 hover:scale-110"
                                    >
                                        <span className="material-symbols-outlined text-[26px]">chevron_left</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Wallet Usage (Bottom) - Fills rest */}
                    <div className="flex-1 bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col overflow-hidden" data-tour="dashboard-wallet-usage">
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
                            {console.log(walletUsage)}
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

