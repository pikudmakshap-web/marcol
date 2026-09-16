import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProduct, updateProduct, deleteProduct, getProductHistory } from '../../services/productService';
import toast from 'react-hot-toast';
import { useProductStore } from '../../store/productStore';
import { useCategoryStore } from '../../store/categoryStore';
import { getSettings } from '../../services/settingsService';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProductImagePlaceholder from '../../components/ProductImagePlaceholder';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';

function Products() {
    const navigate = useNavigate();
    const { products, loading, error, fetchProducts } = useProductStore();
    const { categories: apiCategories, fetchCategories } = useCategoryStore();
    const { user } = useAuthStore();
    const { wallets, fetchWallets } = useWalletStore();
    const isReadOnly = user?.role === 'officer';

    // System Mode Detection
    const hasWallets = wallets?.length > 0;
    const systemMode = !hasWallets ? 'none' : (wallets[0].categoryBalances?.length > 0 ? 'category' : 'general');

    // Get unique categories from all wallets (for category mode)
    const walletCategories = wallets.reduce((acc, wallet) => {
        if (wallet.categoryBalances) {
            wallet.categoryBalances.forEach(cat => {
                if (!acc.includes(cat.categoryName)) acc.push(cat.categoryName);
            });
        }
        return acc;
    }, []);


    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState({ id: 'all', label: 'הכל' });
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [systemSettings, setSystemSettings] = useState({ lowStockThreshold: 10 });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [productHistoryData, setProductHistoryData] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '', description: '', sku: '', barcode: '', category: '',
        unitPrice: '', supplierName: '', imageUrl: '', initialStock: 0, isActive: true
    });

    // Initial default categories
    const defaultCategories = [
        { id: 'all', label: 'הכל' },

    ];

    const categoryMenuRef = useRef(null);
    const formCategoryRef = useRef(null);
    const [showFormCategoryMenu, setShowFormCategoryMenu] = useState(false);

    // Dynamic Categories Logic
    const [allCategories, setAllCategories] = useState(defaultCategories);

    useEffect(() => {
        // Fetch products initially if not loaded
        fetchProducts();
        fetchCategories();
        fetchWallets();

        // Fetch settings
        getSettings().then(data => {
            if (data) setSystemSettings(data);
        }).catch(err => console.error("Failed to fetch settings", err));

        function handleClickOutside(event) {
            if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
                setShowCategoryMenu(false);
            }
            if (formCategoryRef.current && !formCategoryRef.current.contains(event.target)) {
                setShowFormCategoryMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [fetchProducts, fetchCategories]);

    useEffect(() => {
        const newCategories = [...defaultCategories];
        apiCategories.forEach(cat => {
            // Don't show 'ללא קטגוריה' as a filter option (it's the reset state)
            if (cat.name !== 'ללא קטגוריה') {
                newCategories.push({ id: cat.name, label: cat.name, color: cat.color });
            }
        });
        setAllCategories(newCategories);
    }, [apiCategories]);

    const displayedCategories = allCategories.slice(0, 4);
    const moreCategories = allCategories.slice(4);

    const handleOpenAdd = () => {
        if (!hasWallets) {
            toast.error("לא ניתן להוסיף מוצרים ללא ארנק פעיל. צור ארנק ראשון בדף הארנקים.");
            return;
        }
        setIsEditMode(false);
        setCurrentProduct(null);
        setFormData({
            name: '', description: '', sku: '', barcode: '', category: '',
            unitPrice: '', supplierName: '', imageUrl: '', initialStock: 0, isActive: true
        });
        setIsModalOpen(true);
    };

    const handleOpenHistory = async (product) => {
        setCurrentProduct(product);
        setIsHistoryModalOpen(true);
        setIsHistoryLoading(true);
        try {
            const history = await getProductHistory(product.id);
            setProductHistoryData(history);
        } catch (err) {
            toast.error("שגיאה בטעינת היסטוריה");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleOpenEdit = (product) => {
        setIsEditMode(true);
        setCurrentProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            sku: product.sku || '',
            barcode: product.barcode || '',
            category: product.category === "ללא קטגוריה" ? apiCategories[0]?.name : product.category || '',
            unitPrice: product.unitPrice,
            supplierName: product.supplierName || '',
            imageUrl: product.imageUrl || '',
            initialStock: product.quantity || 0,
            isActive: product.isActive,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("האם אתה בטוח שברצונך למחוק מוצר זה?")) {
            try {
                await deleteProduct(id);
                // The socket payload 'product_deleted' will remove it from store instantly
                toast.success("המוצר נמחק בהצלחה");
            } catch (err) {
                toast.error("שגיאה במחיקת מוצר");
            }
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, imageUrl: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    // Pending stock updates state: { [productId]: quantity }
    const [pendingStock, setPendingStock] = useState({});

    const handleAdjustStock = (productId, delta) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const currentQty = product.quantity || 0;
        const pendingQty = pendingStock[productId] !== undefined ? pendingStock[productId] : currentQty;
        const newQty = Math.max(0, pendingQty + delta);

        setPendingStock(prev => ({ ...prev, [productId]: newQty }));
    };

    const handleSaveStock = async (product) => {
        const newQuantity = pendingStock[product.id];
        if (newQuantity === undefined) return;

        // Optimistic UI Update for the main list inside global state (we could fetchProducts(true) instead)
        useProductStore.getState().updateProductState(product.id, { quantity: newQuantity });

        // Clear pending state
        setPendingStock(prev => {
            const next = { ...prev };
            delete next[product.id];
            return next;
        });

        try {
            await updateProduct(product.id, { quantity: newQuantity });
            // fetchProducts(true); // Rely on Socket.io updates instead
        } catch (err) {
            console.error("Failed to update stock", err);
            // Revert changes could happen via Socket.io next update, but manual override here:
            useProductStore.getState().fetchProducts(true); // Explicit refresh on error
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Ensure category is set
            const dataToSave = { ...formData };
            if (!dataToSave.category) {
                toast.error('חובה לבחור קטגוריה קיימת מהרשימה');
                return;
            }

            // Map initialStock to quantity for backend clarity
            if (dataToSave.initialStock !== '') {
                dataToSave.quantity = dataToSave.initialStock;
            }

            if (isEditMode) {
                await updateProduct(currentProduct.id, dataToSave);
            } else {
                await createProduct(dataToSave);
            }
            // The socket payload 'product_added' or '_updated' updates the store directly
            setIsModalOpen(false);
            toast.success("נשמר בהצלחה");

        } catch (err) {
            toast.error("שגיאה בשמירת מוצר: " + (err.response?.data?.error || err.message));
        }
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.barcode && product.barcode.includes(searchTerm));
        const matchesCategory = selectedCategory.id === 'all' ||
            (product.category === selectedCategory.id) ||
            (product.category === selectedCategory.label); // Check both for robust matching
        return matchesSearch && matchesCategory;
    });

    const getStatusColor = (product) => {
        if (!product.isActive) return 'bg-gray-100 text-gray-500 border-gray-200';
        const qty = product.quantity || 0;
        const initialQty = product.initialQuantity || 0;
        const percentage = systemSettings.lowStockPercentage || 10;
        const threshold = (initialQty * percentage) / 100;

        if (qty === 0) return 'bg-[#ffebee] text-[#c62828] border-[#ffcdd2]';
        if (qty <= threshold) return 'bg-[#fff3e0] text-[#ef6c00] border-[#ffe0b2]';
        return 'bg-[#e8f5e9] text-[#2e7d32] border-[#c8e6c9]';
    };

    const getStatusText = (product) => {
        if (!product.isActive) return 'לא פעיל';
        const qty = product.quantity || 0;
        const initialQty = product.initialQuantity || 0;
        const percentage = systemSettings.lowStockPercentage || 10;
        const threshold = (initialQty * percentage) / 100;

        if (qty === 0) return 'אזל';
        if (qty <= threshold) return 'נמוך';
        return 'במלאי';
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
                        onClick={fetchProducts}
                        className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        נסה שוב
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Filters Bar */}
            <div className="bg-white rounded-[24px] p-2 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-2 relative z-20">
                {/* Search - Global */}
                <div className="relative flex-1 w-full flex items-center gap-2">
                    {/* Selected Category Tag */}
                    {selectedCategory.id !== 'all' && (
                        <div className="bg-[#e2e8f0] text-[#2d3748] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                            {selectedCategory.label}
                            <button onClick={() => setSelectedCategory(defaultCategories[0])} className="hover:text-red-500">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>
                    )}

                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="חפש מוצר (שם, ברקוד)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-4 pr-12 py-3 bg-[#f7fafc] border-none rounded-full text-sm focus:ring-2 focus:ring-[#526f52]/20"
                        />
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    </div>
                </div>

                {/* Categories */}
                <div className="flex items-center gap-2 w-full md:w-auto px-2">
                    {displayedCategories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory.id === cat.id
                                ? 'bg-[#526f52] text-white shadow-md'
                                : 'bg-[#f7fafc] text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}

                    {/* More Categories Menu */}
                    {moreCategories.length > 0 && (
                        <div className="relative" ref={categoryMenuRef}>
                            <button
                                onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${moreCategories.some(c => c.id === selectedCategory.id)
                                    ? 'bg-[#526f52] text-white shadow-md'
                                    : 'bg-[#f7fafc] text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                <span className="material-symbols-outlined">more_horiz</span>
                            </button>

                            {/* Dropdown */}
                            {showCategoryMenu && (
                                <div className="absolute top-12 left-0 min-w-[160px] bg-white rounded-xl shadow-xl border border-gray-100 p-2 flex flex-col z-50 gap-1  max-h-60 overflow-y-auto custom-scrollbar">
                                    {moreCategories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                setSelectedCategory(cat);
                                                setShowCategoryMenu(false);
                                            }}
                                            className={`text-right px-4 py-2 rounded-lg text-sm transition-colors ${selectedCategory.id === cat.id
                                                ? 'bg-[#f0fdf4] text-[#166534] font-bold'
                                                : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {/* Add Product Button */}
                {!isReadOnly && (
                    <button
                        onClick={handleOpenAdd}
                        className="bg-[#526f52] text-white w-10 h-10 md:w-auto md:px-4 rounded-full flex items-center justify-center gap-2 shadow-md hover:bg-[#435c43] transition-colors"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span className="hidden md:inline font-bold">הוסף מוצר</span>
                    </button>
                )}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                    <div
                        key={product.id}
                        className="group bg-white rounded-[32px] p-4 shadow-[0_2px_10px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-transparent hover:border-[#526f52]/10 transition-all duration-300 relative overflow-hidden flex flex-col"
                    >
                        {/* Image Container */}
                        <div className="h-32 mb-4 mt-2 relative flex items-center justify-center shrink-0 rounded-2xl overflow-hidden">
                            {product.imageUrl ? (
                                <>
                                    {/* Blurred Background */}
                                    <img
                                        src={product.imageUrl}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-110 pointer-events-none mix-blend-multiply"
                                        aria-hidden="true"
                                    />
                                    {/* Main Image */}
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="relative z-10 max-w-[95%] max-h-[95%] object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-125"
                                    />
                                </>
                            ) : (
                                <ProductImagePlaceholder name={product.name} size="lg" className="transition-transform duration-500 group-hover:scale-105" />
                            )}

                            {/* Top Left Controls */}
                            <div className="absolute top-2 left-2 z-20 flex bg-white/60 backdrop-blur-md rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                {!isReadOnly && (
                                    <>
                                        <button
                                            onClick={() => handleOpenHistory(product)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-[#526f52] transition-colors"
                                            title="היסטוריה"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">history</span>
                                        </button>
                                        <div className="w-[1px] h-4 bg-gray-300 my-auto"></div>
                                        <button
                                            onClick={() => handleOpenEdit(product)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-[#526f52] transition-colors"
                                            title="ערוך"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                        <div className="w-[1px] h-4 bg-gray-300 my-auto"></div>
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors"
                                            title="מחק"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Price Tag */}
                        <div className="absolute top-3 right-3 z-0 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm text-sm font-bold text-[#2d3748]">
                            ₪{product.unitPrice.toFixed(2)}
                        </div>

                        {/* Content */}
                        <div className="space-y-2 px-1 flex-1 flex flex-col justify-between">
                            <div>
                                {console.log(product)}
                                <h3 className="font-bold text-[#2d3748] text-lg leading-tight truncate" title={product.name}>{product.name}</h3>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-gray-400 text-xs">{product.category}</p>
                                    <p className="text-xs text-gray-300">
                                        {product.barcode
                                            ? `ברקוד: ${product.barcode
                                            }` : 'אין מידע על ברקוד'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(product)}`}>
                                    {getStatusText(product)}
                                </span>

                                {/* Stock Control */}
                                {/* Stock Control */}
                                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1.5" onClick={(e) => e.stopPropagation()}>
                                    {pendingStock[product.id] !== undefined ? (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAdjustStock(product.id, -1);
                                                }}
                                                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">remove</span>
                                            </button>

                                            <input
                                                type="number"
                                                autoFocus
                                                value={pendingStock[product.id]}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setPendingStock(prev => ({ ...prev, [product.id]: Math.max(0, val) }));
                                                }}
                                                className="w-16 h-8 text-center text-sm font-bold text-[#526f52] bg-transparent border-b border-[#526f52]/20 focus:border-[#526f52] focus:outline-none appearance-none"
                                            />

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAdjustStock(product.id, 1);
                                                }}
                                                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-[#526f52] hover:bg-[#526f52]/10 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">add</span>
                                            </button>

                                            <div className="flex items-center gap-1 border-r border-gray-200 pr-1 mr-1 animate-in fade-in slide-in-from-right-2 duration-200">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const currentQty = product.quantity || 0;
                                                        const newQty = pendingStock[product.id];

                                                        if (currentQty === newQty) {
                                                            // No changes, just close
                                                            setPendingStock(prev => {
                                                                const next = { ...prev };
                                                                delete next[product.id];
                                                                return next;
                                                            });
                                                        } else {
                                                            // Save changes
                                                            handleSaveStock(product);
                                                        }
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-[#526f52] text-white shadow-md flex items-center justify-center hover:bg-[#435c43] transition-colors"
                                                    title="אישור"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-sm font-bold text-[#2d3748] px-2 whitespace-nowrap">
                                                מלאי: {product.quantity || 0}
                                            </span>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPendingStock(prev => ({ ...prev, [product.id]: product.quantity || 0 }));
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-[#526f52] transition-colors"
                                                    title="עדכן מלאי"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal - Add/Edit Product */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>

                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#2d3748]">{isEditMode ? 'עדכון מוצר' : 'הוספת מוצר חדש'}</h2>
                                    <p className="text-gray-400 text-sm">מלא את פרטי המוצר למטה</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {/* Form */}
                            <div className="p-8 overflow-y-auto custom-scrollbar">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Top Section: Image + Basic Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Image Upload (Right) */}
                                        <div className="flex flex-col gap-2 md:col-span-1">
                                            <div className="w-full h-48 rounded-2xl bg-gray-100 shrink-0 overflow-hidden border border-gray-200 relative group flex items-center justify-center">
                                                {formData.imageUrl ? (
                                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain bg-gray-50" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 flex-col gap-2 p-4 text-center">
                                                        <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                                                        <span className="text-sm font-medium">העלאת תמונה</span>
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                />
                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold pointer-events-none z-20">
                                                    החלף
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-gray-400 leading-tight">מקסימום 5MB<br />פורמטים: JPG, PNG</p>
                                            </div>
                                        </div>

                                        {/* Basic Info (Left) */}
                                        <div className="flex flex-col gap-4 md:col-span-2 justify-center">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1 text-center">שם המוצר *</label>
                                                <input
                                                    type="text" required
                                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                />
                                            </div>
                                            <div ref={formCategoryRef}>
                                                <label className="block text-sm font-bold text-gray-700 mb-1 text-center">קטגוריה *</label>
                                                <div className="relative group/select">
                                                    {systemMode === 'category' ? (
                                                        <select
                                                            required
                                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent text-sm focus:bg-white focus:ring-2 focus:ring-[#526f52]/40 focus:border-transparent text-[#2d3748] transition-all cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] appearance-none"
                                                            value={formData.category}
                                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                        >
                                                            <option value="" disabled>בחר קטגוריה קיימת מהארנקים</option>
                                                            {walletCategories.map((name) => (
                                                                <option key={name} value={name}>{name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <div className="relative">
                                                            <input
                                                                list="categories-datalist"
                                                                required
                                                                placeholder="הקלד קטגוריה חדשה או בחר קיימת..."
                                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                                                                value={formData.category}
                                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                            />
                                                            <datalist id="categories-datalist">
                                                                {apiCategories.map((c) => (
                                                                    <option key={c.id} value={c.name} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none text-gray-500">
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            {systemMode === 'category' ? 'expand_more' : 'edit_note'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1 text-center">
                                                    {systemMode === 'category' ? 'במצב חלוקה לקטגוריות - ניתן לבחור רק קטגוריה קיימת מהתקציב' : 'ניתן להקליד שם של קטגוריה חדשה שתיווצר אוטומטית'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1 text-center">מחיר (₪) *</label>
                                            <input
                                                type="number" step="0.01" required
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                value={formData.unitPrice}
                                                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1 text-center">מק"ט</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                value={formData.sku}
                                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1 text-center">ברקוד *</label>
                                            <input
                                                type="text" required
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                value={formData.barcode}
                                                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1 text-center">חייב להיות ייחודי</p>
                                        </div>
                                    </div>

                                    {/* Stock, Supplier, Description */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1 text-center">כמות במלאי</label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, initialStock: Math.max(0, Number(prev.initialStock || 0) - 1) }))}
                                                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
                                                >
                                                    <span className="material-symbols-outlined">remove</span>
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 text-center font-bold"
                                                    value={formData.initialStock}
                                                    onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, initialStock: Number(prev.initialStock || 0) + 1 }))}
                                                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
                                                >
                                                    <span className="material-symbols-outlined">add</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1 text-center">ספק</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                value={formData.supplierName}
                                                onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1 text-center">תיאור</label>
                                            <textarea
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 resize-none overflow-hidden"
                                                rows="1"
                                                style={{ minHeight: '44px' }}
                                                value={formData.description}
                                                onInput={(e) => {
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                }}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        className="w-full bg-[#526f52] hover:bg-[#435c43] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                                    >
                                        {isEditMode ? 'שמור שינויים' : 'צור מוצר'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Modal - Product History */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsHistoryModalOpen(false)}></div>

                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-2xl font-bold text-[#2d3748]">היסטוריית רכישות - {currentProduct?.name}</h2>
                                <p className="text-gray-400 text-sm">צפה בכל הרכישות של מוצר זה</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 py-6 overflow-y-auto custom-scrollbar">
                            {isHistoryLoading ? (
                                <div className="flex justify-center p-8"><span className="material-symbols-outlined animate-spin text-4xl text-[#526f52]">sync</span></div>
                            ) : productHistoryData.length === 0 ? (
                                <div className="text-center p-8 text-gray-500">לא נמצאו רכישות עבור מוצר זה.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right">
                                        <thead className="bg-[#f7fafc] border-y border-gray-100">
                                            <tr>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-600">תאריך עיסקה</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-600">ארנק קונה</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-600">כמות נלקחה</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-600">מחיר יחידה</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-600">סה"כ צבירה</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-600">קופאי</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {productHistoryData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-[#2d3748] whitespace-nowrap">
                                                        <div className="font-bold">{new Date(item.date).toLocaleDateString('he-IL')}</div>
                                                        <div className="text-xs text-gray-400">{new Date(item.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-[#2d3748]">
                                                        {item.walletName}
                                                        <span className="text-xs text-gray-500 block">{item.walletNumber}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block min-w-[2rem] text-center ${item.transactionType === 'return' ? 'bg-[#ffebee] text-[#c62828] border border-[#ffcdd2]' : 'bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9]'
                                                            }`}>
                                                            {Math.abs(item.quantity)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">
                                                        ₪{item.unitPrice.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-[#2d3748]">
                                                        ₪{item.lineTotal.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {item.cashierName}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

export default Products;
