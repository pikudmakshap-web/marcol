import { useState, useEffect, useCallback, useRef } from 'react';
import { useProductStore } from '../../store/productStore';
import { searchWallets } from '../../services/walletService';
import { createTransaction } from '../../services/transactionService';
import toast from 'react-hot-toast';

const POSCheckout = () => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date) => {
        return date.toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    // Store Data
    const { products, loading, fetchProducts } = useProductStore();

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // Derived Categories
    const allCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const displayCategories = allCategories.slice(0, 3);
    const hasMoreCategories = allCategories.length > 3;

    // View States
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Modals State
    const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
    const [isManualBarcodeOpen, setIsManualBarcodeOpen] = useState(false);
    const [manualBarcodeQuery, setManualBarcodeQuery] = useState('');
    const [isPriceCheckOpen, setIsPriceCheckOpen] = useState(false);
    const [priceCheckQuery, setPriceCheckQuery] = useState('');
    const [isWalletCheckOpen, setIsWalletCheckOpen] = useState(false);
    const [walletCheckQuery, setWalletCheckQuery] = useState('');
    const [walletCheckResult, setWalletCheckResult] = useState(null);
    const [walletCheckWallets, setWalletCheckWallets] = useState([]);
    const [walletCheckError, setWalletCheckError] = useState('');

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentQuery, setPaymentQuery] = useState('');
    const [paymentWallets, setPaymentWallets] = useState([]);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [paymentError, setPaymentError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const fetchPaymentWallets = async () => {
            if (!paymentQuery) {
                setPaymentWallets([]);
                setSelectedWallet(null);
                setPaymentError('');
                return;
            }
            try {
                const results = await searchWallets(paymentQuery);
                setPaymentWallets(results);
                if (results.length === 0) setSelectedWallet(null);
                else if (results.length === 1) setSelectedWallet(results[0]);
                else setSelectedWallet(null);
            } catch (err) {
                setPaymentError('שגיאה בחיפוש ארנק');
            }
        };

        const timer = setTimeout(fetchPaymentWallets, 300);
        return () => clearTimeout(timer);
    }, [paymentQuery]);

    useEffect(() => {
        const fetchCheckWallets = async () => {
            if (!walletCheckQuery) {
                setWalletCheckWallets([]);
                setWalletCheckResult(null);
                setWalletCheckError('');
                return;
            }
            try {
                const results = await searchWallets(walletCheckQuery);
                setWalletCheckWallets(results);
                if (results.length === 0) setWalletCheckResult(null);
                else if (results.length === 1) setWalletCheckResult(results[0]);
                else setWalletCheckResult(null);
            } catch (err) {
                setWalletCheckError('שגיאה בחיפוש ארנק');
            }
        };

        const timer = setTimeout(fetchCheckWallets, 300);
        return () => clearTimeout(timer);
    }, [walletCheckQuery]);

    const handlePaymentSearch = (e) => {
        e.preventDefault();
        // search handled by useEffect
    };

    const handleWalletCheckSearch = (e) => {
        e.preventDefault();
        // search handled by useEffect
    };

    const handleCheckout = async () => {
        if (!selectedWallet) return;

        // Determine officerId
        let officerId = null;
        const matchedUser = selectedWallet.walletUsers?.find(wu =>
            wu.user.personalNumber === paymentQuery || wu.user.barcode === paymentQuery
        );
        if (matchedUser) {
            officerId = matchedUser.user.id;
        } else if (selectedWallet.walletUsers?.length > 0) {
            officerId = selectedWallet.walletUsers[0].user.id;
        }

        if (!officerId) {
            setPaymentError('לא הוגדר משתמש לארנק זה, לא ניתן לבצע עסקה');
            return;
        }

        setIsProcessing(true);
        setPaymentError('');
        try {
            const items = orderItems.map(item => ({
                productId: item.id,
                productName: item.name,
                quantity: item.qty,
                unitPrice: item.price
            }));

            await createTransaction({
                officerId: officerId,
                walletId: selectedWallet.id,
                items,
                notes: ''
            });

            setOrderItems([]);
            setIsPaymentModalOpen(false);
            setSelectedWallet(null);
            setPaymentQuery('');
            setPaymentWallets([]);
            setIsPriceCheckOpen(false); // Optionally confirm
            toast.success('העסקה בוצעה בהצלחה!');
        } catch (err) {
            setPaymentError(err.response?.data?.error || 'שגיאה בביצוע העסקה');
        } finally {
            setIsProcessing(false);
        }
    };

    // Filtered Products
    const categoryProducts = selectedCategory
        ? products.filter(p => p.category === selectedCategory)
        : [];

    const priceCheckResults = priceCheckQuery
        ? products.filter(p =>
            p.name.toLowerCase().includes(priceCheckQuery.toLowerCase()) ||
            (p.barcode && p.barcode.includes(priceCheckQuery))
        )
        : [];

    const manualBarcodeResults = manualBarcodeQuery
        ? products.filter(p =>
            p.name.toLowerCase().includes(manualBarcodeQuery.toLowerCase()) ||
            (p.barcode && p.barcode.includes(manualBarcodeQuery))
        )
        : [];

    // Mock Data based on image
    const [orderItems, setOrderItems] = useState([
        // { id: 1, name: "חלב 3% שומן קרטון 1 ליטר פיקוח תנובה", price: 7.28, qty: 1 },
        // { id: 2, name: "חלב 3% שומן קרטון 1 ליטר פיקוח תנובה", price: 7.28, qty: 1 },
    ]);

    const handleRemoveItem = (id) => {
        setOrderItems(orderItems.filter(item => item.id !== id));
    };

    const updateItemQty = (id, delta) => {
        setOrderItems(prevItems => {
            return prevItems.map(item => {
                if (item.id === id) {
                    const newQty = item.qty + delta;
                    if (newQty <= 0) return null; // Mark for removal

                    // Validate against stock
                    const productStock = item.quantity || 0;
                    if (newQty > productStock) {
                        toast.error(`אין מספיק מלאי עבור '${item.name}'. המלאי הזמין: ${productStock}`, { id: `stock-${item.id}` });
                        return item; // Keep previous quantity
                    }

                    return { ...item, qty: newQty };
                }
                return item;
            }).filter(Boolean); // Filter out the nulls (removed items)
        });
    };

    const handleAddToCart = useCallback((product) => {
        const productStock = product.quantity || 0;

        if (productStock <= 0) {
            toast.error(`המוצר '${product.name}' אזל מהמלאי ולא ניתן להוסיפו לעגלה.`, { id: `stock-${product.id}` });
            return;
        }

        setOrderItems(prevItems => {
            const existingItem = prevItems.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.qty >= productStock) {
                    toast.error(`לא ניתן להוסיף. הגעת לכמות המקסימלית במלאי עבור '${product.name}' (${productStock}).`, { id: `stock-${product.id}` });
                    return prevItems;
                }
                return prevItems.map(item =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            const safePrice = product?.unitPrice ? Number(product.unitPrice) : 0;
            return [{ ...product, qty: 1, price: safePrice }, ...prevItems];
        });
        setSelectedCategory(null);
    }, []);

    const barcodeBufferRef = useRef('');
    const lastKeyTimeRef = useRef(Date.now());

    // Global Barcode Scanner Listener
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Ignore if typing inside input fields 
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const currentTime = Date.now();

            // Scanners type very quickly. If more than 500ms passed since last keystroke, reset buffer
            if (currentTime - lastKeyTimeRef.current > 500) {
                barcodeBufferRef.current = '';
            }
            lastKeyTimeRef.current = currentTime;

            if (e.key === 'Enter') {
                if (barcodeBufferRef.current.length >= 3) {
                    e.preventDefault();

                    // Do not process global scans if modals are open
                    if (isPaymentModalOpen || isCategoriesModalOpen || isManualBarcodeOpen || isPriceCheckOpen || isWalletCheckOpen) {
                        barcodeBufferRef.current = '';
                        return;
                    }

                    const scannedBarcode = barcodeBufferRef.current.trim();
                    const product = products.find(p => p.barcode === scannedBarcode);

                    if (product) {
                        handleAddToCart(product);
                    } else {
                        toast.error(`לא נמצא מוצר עם ברקוד ${scannedBarcode}`);
                    }
                    barcodeBufferRef.current = '';
                }
            } else if (e.key.length === 1) { // Normal character stroke
                // Check if it's alphanumeric (Hebrew/English numbers are numbers anyway)
                barcodeBufferRef.current += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [products, isPaymentModalOpen, isCategoriesModalOpen, isManualBarcodeOpen, isPriceCheckOpen, isWalletCheckOpen, handleAddToCart]);

    const totalItems = orderItems.reduce((sum, item) => sum + (item.qty === '' ? 0 : item.qty), 0);
    const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * (item.qty === '' ? 0 : item.qty)), 0);

    return (
        <>
            <div className="flex flex-col lg:flex-row-reverse gap-4 h-[calc(100vh-5rem)] max-w-[1600px] mx-auto p-2 font-sans overflow-hidden">

                {/* Left Column: Order Summary (Receipt) */}
                <div className="flex-[1.2] bg-white rounded-[24px] shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 p-4 bg-gray-50 border-b border-gray-100 text-[#a0aec0] font-bold text-sm text-center">
                        <div className="col-span-4 text-right pr-4">שם פריט</div>
                        <div className="col-span-3">כמות</div>
                        <div className="col-span-2">מחיר</div>
                        <div className="col-span-2">סה"כ</div>
                        <div className="col-span-1 text-right"></div> {/* Delete Button Space */}
                    </div>

                    {/* Items List */}
                    <div className={`flex-1 overflow-y-auto p-4 space-y-2 ${orderItems.length > 0 ? 'custom-scrollbar' : ''}`}>
                        {orderItems.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center py-3 border-b border-dashed border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors rounded-xl group">
                                <div className="col-span-4 flex items-center gap-3 pr-4 text-sm font-bold text-[#2d3748]">
                                    <div className="w-10 h-10 bg-white rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-gray-300 text-xl">image</span>
                                        )}
                                    </div>
                                    <span className="text-right" title={item.name}>
                                        {item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name}
                                    </span>
                                </div>
                                <div className="col-span-3 text-center font-bold text-gray-700 flex items-center justify-center gap-1">
                                    <button onClick={() => updateItemQty(item.id, 1)} className="w-6 h-6 rounded-full bg-[#ecfdf5] text-[#166534] hover:bg-[#d1fae5] flex items-center justify-center transition-colors">
                                        <span className="material-symbols-outlined text-[1rem]">add</span>
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.qty === '' ? '' : item.qty}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: '' } : i));
                                            } else {
                                                const numericVal = parseInt(val, 10);
                                                if (!isNaN(numericVal) && numericVal > 0) {
                                                    const productStock = item.quantity || 0;
                                                    if (numericVal > productStock) {
                                                        toast.error(`אין מספיק מלאי עבור '${item.name}'. המלאי הזמין: ${productStock}`, { id: `stock-${item.id}` });
                                                    } else {
                                                        setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: numericVal } : i));
                                                    }
                                                }
                                            }
                                        }}
                                        onBlur={() => {
                                            if (item.qty === '' || item.qty <= 0) {
                                                updateItemQty(item.id, 1 - item.qty); // Reset to 1 on empty blur
                                            }
                                        }}
                                        className="w-16 text-center bg-transparent border-none focus:outline-none font-bold text-gray-700 mx-1 no-spinners"
                                    />
                                    <button onClick={() => updateItemQty(item.id, -1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors">
                                        <span className="material-symbols-outlined text-[1rem]">remove</span>
                                    </button>
                                </div>
                                <div className="col-span-2 text-center text-gray-500 text-sm">{item.price.toFixed(2)}</div>
                                <div className="col-span-2 text-center font-bold text-[#2d3748]">₪{(item.price * (item.qty === '' ? 0 : item.qty)).toFixed(2)}</div>
                                <div className="col-span-1 flex justify-center">
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-red-100 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-sm font-bold">close</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {orderItems.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <span className="material-symbols-outlined text-6xl mb-4 opacity-50">shopping_cart</span>
                                <p>העגלה ריקה. סרוק ברקוד כדי להתחיל.</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom Total Area */}
                    <div className="bg-gray-50 p-6 flex items-center justify-between border-t border-gray-100">
                        <div className="text-right flex flex-col justify-center">
                            <div className="text-[#2d3748] font-bold text-lg mb-1">
                                סכום לקנייה <span className="font-black text-xl">{(totalPrice).toFixed(2)} ש"ח</span>
                            </div>
                            <div className="text-gray-500 text-sm">
                                סה"כ {totalItems} מוצרים
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (orderItems.length > 0) {
                                    setIsPaymentModalOpen(true);
                                } else {
                                    toast.error('העגלה ריקה');
                                }
                            }}
                            className="bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#3ce619] px-12 py-5 rounded-full font-black text-2xl shadow-sm transform transition-transform active:scale-95 border-2 border-[#3ce619]/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={orderItems.length === 0}
                        >
                            <span className="material-symbols-outlined text-3xl font-bold">eco</span>
                            לתשלום
                        </button>
                    </div>
                </div>

                {/* Right Column: Interaction / Kiosk Display */}
                <div className="flex-1 bg-[#bbf7d0] rounded-[24px] shadow-lg flex flex-col p-6 lg:p-10 relative overflow-hidden text-[#166534] h-full justify-center border border-[#86efac]">
                    {/* Clock */}
                    <div className="absolute top-6 right-8 font-black text-3xl text-[#15803d] bg-white/40 px-5 py-3 rounded-2xl shadow-sm backdrop-blur-md border border-white/50 z-20 flex items-center gap-3 font-mono">
                        <span className="material-symbols-outlined text-3xl">schedule</span>
                        {formatTime(currentTime)}
                    </div>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 z-10">
                            <div className="w-16 h-16 border-4 border-[#3ce619]/30 border-t-[#3ce619] rounded-full animate-spin"></div>
                            <span className="text-lg font-bold text-[#166534]">טוען נתונים...</span>
                        </div>
                    ) : (
                        <>
                            {/* Main Instruction & Buttons */}
                            <div className="text-center mb-8 shrink-0 flex flex-col justify-center items-center relative z-10 w-full mt-2">
                                <h1 className="text-4xl lg:text-5xl font-black text-[#3ce619] tracking-tight mb-8 flex flex-col items-center justify-center gap-4 drop-shadow-sm">
                                    <div className="w-20 h-20 bg-[#ecfdf5] rounded-full flex items-center justify-center shadow-inner border border-[#3ce619]/10">
                                        <span className="material-symbols-outlined text-[3rem]">eco</span>
                                    </div>
                                    סרוק את הברקוד
                                </h1>

                                {/* Action Buttons underneath */}
                                <div className="flex flex-wrap justify-center gap-3 mb-8 w-full max-w-lg">
                                    <button onClick={() => setIsManualBarcodeOpen(true)} className="flex-1 min-w-[140px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#3ce619] py-4 px-2 rounded-full font-bold text-sm sm:text-base transition-transform hover:scale-105 border-2 border-[#3ce619]/20 shadow-sm flex flex-col items-center justify-center gap-1">
                                        <span className="material-symbols-outlined text-2xl">keyboard</span>
                                        הקלדת פריט
                                    </button>
                                    <button onClick={() => setIsPriceCheckOpen(true)} className="flex-1 min-w-[140px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#3ce619] py-4 px-2 rounded-full font-bold text-sm sm:text-base transition-transform hover:scale-105 border-2 border-[#3ce619]/20 shadow-sm flex flex-col items-center justify-center gap-1">
                                        <span className="material-symbols-outlined text-2xl">search</span>
                                        בדיקת מחיר
                                    </button>
                                    <button onClick={() => setIsWalletCheckOpen(true)} className="flex-1 min-w-[140px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#3ce619] py-4 px-2 rounded-full font-bold text-sm sm:text-base transition-transform hover:scale-105 border-2 border-[#3ce619]/20 shadow-sm flex flex-col items-center justify-center gap-1">
                                        <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                                        יתרת ארנק
                                    </button>
                                </div>

                                <div className="flex items-center justify-center gap-4 w-full">
                                    <div className="h-px w-16 bg-[#3ce619]"></div>
                                    <span className="text-[#15803d] text-sm font-medium">או בחר קטגוריה</span>
                                    <div className="h-px w-16 bg-[#3ce619]"></div>
                                </div>
                            </div>

                            {/* Dynamic Content Area */}
                            {selectedCategory ? (
                                <div className="flex flex-col h-full overflow-hidden">
                                    <div className="flex items-center justify-between mb-4 shrink-0">
                                        <h2 className="text-2xl font-bold text-[#166534] pr-2">מוצרי {selectedCategory}</h2>
                                        <button onClick={() => setSelectedCategory(null)} className="w-10 h-10 rounded-full bg-white/50 border border-white/80 text-[#166534] hover:bg-white flex items-center justify-center shadow-sm transition-all">
                                            <span className="material-symbols-outlined">arrow_forward</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-3 pb-4 pr-1">
                                        {categoryProducts.map(product => {
                                            console.log(product);

                                            const safePrice = product?.unitPrice ? Number(product.unitPrice) : 0;
                                            const outOfStock = (product.quantity || 0) <= 0;
                                            return (
                                                <button key={product.id} onClick={() => !outOfStock && handleAddToCart(product)} className={`bg-white border rounded-2xl p-4 flex items-center justify-between transition-transform shadow-sm text-right w-full relative overflow-hidden ${outOfStock ? 'opacity-70 cursor-not-allowed border-gray-200 bg-gray-50/50' : 'hover:bg-gray-50 border-white/50 hover:scale-[1.02] text-[#166534]'}`}>
                                                    {/* Product Details (Right) */}
                                                    <div className={`flex items-center gap-3 overflow-hidden flex-1 pl-2 ${outOfStock ? 'opacity-40' : ''}`}>
                                                        <div className={`w-10 h-14 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center relative ${outOfStock ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
                                                            {product.imageUrl ? (
                                                                <img src={product.imageUrl} alt={product.name} className={`w-full h-full object-cover ${outOfStock ? 'grayscale opacity-50' : ''}`} />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-gray-300 text-2xl">image</span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className={`font-bold text-sm sm:text-base leading-tight truncate px-1 ${outOfStock ? 'text-gray-500' : ''}`}>{product.name}</span>
                                                            <span className="text-xs text-gray-400 px-1 truncate">{product.sku ? `מק"ט: ${product.sku}` : 'אין מק"ט'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Price (Left) */}
                                                    <div className={`shrink-0 text-left flex flex-col items-end gap-1 ${outOfStock ? 'opacity-40' : ''}`}>
                                                        <span className={`px-3 py-1 rounded-full font-black text-lg border ${outOfStock ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-[#ecfdf5] text-[#166534] border-[#3ce619]/20'}`}>₪{safePrice.toFixed(2)}</span>
                                                    </div>

                                                    {/* Out of stock central stamp */}
                                                    {outOfStock && (
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <div className="border-2 border-red-500/80 text-red-500/80 font-black text-xl px-4 py-1 transform -rotate-12 rounded-lg bg-white/90 shadow-sm backdrop-blur-sm">אזל מהמלאי</div>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {categoryProducts.length === 0 && (
                                            <div className="text-center text-[#15803d]/70 py-8 w-full border-2 border-dashed border-[#15803d]/20 rounded-2xl">אין מוצרים בקטגוריה זו.</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto w-full z-10 pb-4">
                                    {displayCategories.map((cat, idx) => {
                                        const icon = cat.includes('פירות') ? '🍎' : cat.includes('ירקות') ? '🥕' : cat.includes('לחם') ? '🥐' : cat.includes('מארזים') ? '🥤' : '📦';
                                        return (
                                            <button key={idx} onClick={() => setSelectedCategory(cat)} className="bg-[#ecfdf5] hover:bg-[#d1fae5] border-2 border-[#3ce619]/10 rounded-3xl h-32 flex flex-col items-center justify-center gap-3 transition-transform hover:scale-105 group shadow-sm text-[#3ce619]">
                                                <span className="text-5xl group-hover:-translate-y-1 transition-transform drop-shadow-sm">{icon}</span>
                                                <span className="font-bold text-lg text-[#166534]">{cat}</span>
                                            </button>
                                        );
                                    })}

                                    {hasMoreCategories ? (
                                        <button onClick={() => setIsCategoriesModalOpen(true)} className="bg-[#ecfdf5] hover:bg-[#d1fae5] border-2 border-[#3ce619]/10 rounded-3xl h-32 flex flex-col items-center justify-center gap-3 transition-transform hover:scale-105 group shadow-sm text-[#3ce619]">
                                            <span className="material-symbols-outlined text-[3rem] group-hover:-translate-y-1 transition-transform drop-shadow-sm text-[#3ce619]">more_horiz</span>
                                            <span className="font-bold text-lg text-[#166534]">עוד קטגוריות</span>
                                        </button>
                                    ) : (
                                        allCategories.length > displayCategories.length && allCategories.slice(3, 4).map((cat, idx) => (
                                            <button key="last" onClick={() => setSelectedCategory(cat)} className="bg-[#ecfdf5] hover:bg-[#d1fae5] border-2 border-[#3ce619]/10 rounded-3xl h-32 flex flex-col items-center justify-center gap-3 transition-transform hover:scale-105 group shadow-sm text-[#3ce619]">
                                                <span className="text-5xl group-hover:-translate-y-1 transition-transform drop-shadow-sm">📦</span>
                                                <span className="font-bold text-lg text-[#166534]">{cat}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Background Decor */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-[#3ce619]/5 rounded-full blur-[100px] pointer-events-none"></div>
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}

            {/* More Categories Modal */}
            {
                isCategoriesModalOpen && (
                    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCategoriesModalOpen(false)}></div>
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                <h2 className="text-2xl font-bold text-[#166534]">בחר קטגוריה</h2>
                                <button onClick={() => setIsCategoriesModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-8 overflow-y-auto">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                    {allCategories.map((cat, idx) => (
                                        <button key={idx} onClick={() => { setIsCategoriesModalOpen(false); setSelectedCategory(cat); }} className="bg-[#ecfdf5] hover:bg-[#d1fae5] border-2 border-[#3ce619]/10 rounded-3xl h-32 flex flex-col items-center justify-center gap-3 transition-transform hover:scale-105 group shadow-sm text-[#3ce619]">
                                            <span className="font-bold text-lg text-[#166534] text-center px-2">{cat}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Manual Barcode Modal */}
            {
                isManualBarcodeOpen && (
                    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsManualBarcodeOpen(false)}></div>
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col">
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                <h2 className="text-2xl font-bold text-[#166534] flex items-center gap-2">
                                    <span className="material-symbols-outlined">keyboard</span>
                                    הכנסת ברקוד ידנית
                                </h2>
                                <button onClick={() => { setIsManualBarcodeOpen(false); setManualBarcodeQuery(''); }} className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-8 flex flex-col items-center w-full">
                                <input
                                    type="text"
                                    placeholder="הקש פריט / ברקוד כאן..."
                                    autoFocus
                                    value={manualBarcodeQuery}
                                    onChange={(e) => setManualBarcodeQuery(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-center text-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3ce619] focus:border-transparent transition-all mb-4"
                                />

                                {manualBarcodeQuery && (
                                    <div className="w-full max-h-[30vh] overflow-y-auto w-full flex flex-col gap-2 custom-scrollbar pr-2 mb-4">
                                        {manualBarcodeResults.length > 0 ? (
                                            manualBarcodeResults.map(p => {
                                                const outOfStock = (p.quantity || 0) <= 0;
                                                return (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            if (!outOfStock) {
                                                                handleAddToCart(p);
                                                                setManualBarcodeQuery('');
                                                                setIsManualBarcodeOpen(false);
                                                            }
                                                        }}
                                                        className={`flex justify-between items-center border p-3 rounded-xl transition-colors text-right w-full relative overflow-hidden ${outOfStock ? 'bg-gray-50/80 border-gray-200 cursor-not-allowed opacity-80' : 'bg-[#ecfdf5] hover:bg-[#d1fae5] border-[#3ce619]/20 hover:border-[#3ce619]/50'}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative ${outOfStock ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-100'}`}>
                                                                {p.imageUrl ? (
                                                                    <img src={p.imageUrl} alt={p.name} className={`w-full h-full object-contain p-1 ${outOfStock ? 'grayscale opacity-50' : ''}`} />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-gray-300 text-2xl">image</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`font-bold ${outOfStock ? 'text-gray-500' : 'text-[#2d3748]'}`}>{p.name}</span>
                                                                <span className="text-xs text-gray-500 flex items-center gap-2">
                                                                    {p.barcode || 'ללא ברקוד'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {!outOfStock ? (
                                                            <span className="material-symbols-outlined text-[#3ce619]">add_circle</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-transparent">add_circle</span>
                                                        )}
                                                        {outOfStock && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 w-full overflow-hidden rounded-xl">
                                                                <div className="border-2 border-red-500/80 text-red-500/80 font-black text-sm px-3 py-1 transform -rotate-12 rounded bg-white/90 shadow-sm backdrop-blur-[2px] whitespace-nowrap">אזל מהמלאי</div>
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center text-gray-400 py-4 text-sm font-bold">לא נמצא מוצר תואם.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Payment Modal */}
            {
                isPaymentModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => !isProcessing && setIsPaymentModalOpen(false)}></div>
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col">
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                <h2 className="text-2xl font-bold text-[#166534] flex items-center gap-2">
                                    <span className="material-symbols-outlined">payments</span>
                                    תשלום - {totalPrice.toFixed(2)} ש"ח
                                </h2>
                                <button onClick={() => !isProcessing && setIsPaymentModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-50">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-8 flex flex-col items-center w-full">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">חיפוש ארנק לשיוך העסקה</h3>
                                <p className="text-gray-500 mb-6 text-center text-sm">הזן מספר אישי / מספר ארנק / ברקוד לאיתור</p>

                                <form onSubmit={handlePaymentSearch} className="w-full relative mb-4">
                                    <input
                                        type="text"
                                        placeholder="הקלד שם ארנק / מספר אישי פריט או ברקוד..."
                                        autoFocus
                                        value={paymentQuery}
                                        onChange={(e) => setPaymentQuery(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-center font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3ce619] focus:border-transparent transition-all pr-12 text-sm"
                                    />
                                    <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#166534] hover:bg-gray-50">
                                        <span className="material-symbols-outlined">search</span>
                                    </button>
                                </form>

                                {paymentError && paymentWallets.length === 0 && (
                                    <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-bold mb-4">
                                        {paymentError}
                                    </div>
                                )}

                                {paymentWallets.length > 1 && !selectedWallet && (
                                    <div className="w-full max-h-[30vh] overflow-y-auto flex flex-col gap-2 custom-scrollbar pr-2 mb-4">
                                        <div className="text-sm font-bold text-gray-500 mb-2">נמצאו מספר ארנקים, בחר אחד:</div>
                                        {paymentWallets.map(w => (
                                            <button key={w.id} onClick={() => setSelectedWallet(w)} className="flex justify-between items-center bg-gray-50 hover:bg-[#ecfdf5] border border-gray-200 hover:border-[#3ce619]/50 p-4 rounded-xl transition-colors w-full text-right">
                                                <div className="flex flex-col text-right">
                                                    <span className="font-bold text-[#2d3748]">{w.name}</span>
                                                    <span className="text-xs text-gray-500">{w.walletNumber}</span>
                                                </div>
                                                <span className="text-[#3ce619] font-black pl-2">₪{w.currentBalance?.toFixed(2)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedWallet && (
                                    <div className="w-full bg-[#ecfdf5] border-2 border-[#3ce619]/30 rounded-xl p-6 mb-6 flex flex-col items-center gap-3">
                                        <span className="material-symbols-outlined text-4xl text-[#3ce619]">account_balance_wallet</span>
                                        <h4 className="font-bold text-xl text-[#166534] text-center w-full">{selectedWallet.name}</h4>
                                        <div className="flex gap-4 text-sm font-medium w-full justify-center">
                                            <span className="text-gray-600">יתרה: <span className="text-[#166534] font-bold">₪{selectedWallet.currentBalance?.toFixed(2)}</span></span>
                                            <span className="text-gray-400">•</span>
                                            <span className="text-gray-600">מספר: <span className="font-mono">{selectedWallet.walletNumber}</span></span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleCheckout}
                                    disabled={!selectedWallet || isProcessing || totalPrice > (selectedWallet?.currentBalance || 0)}
                                    className="w-full bg-[#3ce619] hover:bg-[#32c914] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl py-4 font-black text-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                                >
                                    {isProcessing ? 'מעבד...' : (selectedWallet && totalPrice > selectedWallet.currentBalance ? 'אין מספיק יתרה בארנק' : 'בצע חיוב מתוך הארנק')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Price Check Modal */}
            {
                isPriceCheckOpen && (
                    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsPriceCheckOpen(false)}></div>
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col">
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                <h2 className="text-2xl font-bold text-[#166534] flex items-center gap-2">
                                    <span className="material-symbols-outlined">search</span>
                                    בדיקת מחיר
                                </h2>
                                <button onClick={() => setIsPriceCheckOpen(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-8 flex flex-col items-center w-full">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">חיפוש או סריקת מוצר</h3>
                                <p className="text-gray-500 mb-6 text-center text-sm">הזן שם פריט או ברקוד לבדיקת מחירו מבלי להוסיפו לעגלה.</p>

                                <input
                                    type="text"
                                    placeholder="דוגמא: ארנק מחלקה / מ.א קצין 🔍"
                                    autoFocus
                                    value={priceCheckQuery}
                                    onChange={(e) => setPriceCheckQuery(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-center text-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3ce619] focus:border-transparent transition-all mb-4"
                                />

                                {priceCheckQuery && (
                                    <div className="w-full max-h-[30vh] overflow-y-auto w-full flex flex-col gap-2 custom-scrollbar pr-2 mb-4">
                                        {priceCheckResults.length > 0 ? (
                                            priceCheckResults.map(p => {
                                                const outOfStock = (p.quantity || 0) <= 0;
                                                return (
                                                    <div key={p.id} className={`flex justify-between items-center border p-3 rounded-xl relative overflow-hidden h-[88px] shrink-0 ${outOfStock ? 'bg-gray-50/80 border-gray-200 opacity-80' : 'bg-white border-gray-100/50 shadow-sm hover:shadow-md transition-shadow'}`}>
                                                        <div className={`flex items-center gap-4 flex-1 h-full overflow-hidden ${outOfStock ? 'opacity-50' : ''}`}>
                                                            <div className={`w-14 h-14 flex items-center justify-center shrink-0`}>
                                                                {p.imageUrl ? (
                                                                    <img src={p.imageUrl} alt={p.name} className={`w-full h-full object-contain drop-shadow-sm mix-blend-multiply ${outOfStock ? 'grayscale opacity-60' : ''}`} />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-gray-300 text-2xl">image</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col flex-1 min-w-0 pr-1 select-none">
                                                                <span className={`font-bold text-[15px] text-right leading-[1.2] line-clamp-2 ${outOfStock ? 'text-gray-500' : 'text-[#2d3748]'}`} title={p.name}>{p.name}</span>
                                                            </div>
                                                        </div>
                                                        <span className={`font-black text-xl z-0 shrink-0 mr-3 pl-2 select-none ${outOfStock ? 'text-gray-400 opacity-40' : 'text-[#3ce619]'}`}>₪{(p.unitPrice || 0).toFixed(2)}</span>

                                                        {/* Out of stock central stamp */}
                                                        {outOfStock && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                                                <div className="border-2 border-red-500/80 text-red-500/80 font-black text-xl px-4 py-1 transform -rotate-12 rounded-lg bg-white/90 shadow-sm backdrop-blur-[2px]">אזל מהמלאי</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center text-gray-400 py-4 text-sm font-bold">לא נמצא מוצר תואם.</div>
                                        )}
                                    </div>
                                )}

                                <button onClick={() => { setIsPriceCheckOpen(false); setPriceCheckQuery(''); }} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl py-4 font-bold text-lg transition-colors mt-auto">
                                    סגור חלון
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Wallet Balance Check Modal */}
            {
                isWalletCheckOpen && (
                    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsWalletCheckOpen(false)}></div>
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col">
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                <h2 className="text-2xl font-bold text-[#166534] flex items-center gap-2">
                                    <span className="material-symbols-outlined">account_balance_wallet</span>
                                    בדיקת יתרת ארנק
                                </h2>
                                <button onClick={() => { setIsWalletCheckOpen(false); setWalletCheckQuery(''); setWalletCheckResult(null); setWalletCheckError(''); }} className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-8 flex flex-col items-center w-full">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">חיפוש ארנק</h3>
                                <p className="text-gray-500 mb-6 text-center text-sm">הזן מזהה, מספר אישי, או מספר כרטיס לבדיקת יתרה.</p>

                                <form onSubmit={handleWalletCheckSearch} className="w-full relative mb-4">
                                    <input
                                        type="text"
                                        placeholder="הקלד או סרוק ברקוד ולחץ אנטר..."
                                        autoFocus
                                        value={walletCheckQuery}
                                        onChange={(e) => setWalletCheckQuery(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-center font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3ce619] focus:border-transparent transition-all pr-12 text-sm"
                                    />
                                    <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#166534] hover:bg-gray-50">
                                        <span className="material-symbols-outlined">search</span>
                                    </button>
                                </form>

                                {walletCheckError && walletCheckWallets.length === 0 && (
                                    <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-bold mb-4">
                                        {walletCheckError}
                                    </div>
                                )}

                                {walletCheckWallets.length > 1 && !walletCheckResult && (
                                    <div className="w-full max-h-[30vh] overflow-y-auto flex flex-col gap-2 custom-scrollbar pr-2 mb-4">
                                        <div className="text-sm font-bold text-gray-500 mb-2">נמצאו מספר ארנקים, בחר אחד לבדיקה:</div>
                                        {walletCheckWallets.map(w => (
                                            <button key={w.id} onClick={() => setWalletCheckResult(w)} className="flex justify-between items-center bg-gray-50 hover:bg-[#ecfdf5] border border-gray-200 hover:border-[#3ce619]/50 p-4 rounded-xl transition-colors w-full text-right">
                                                <div className="flex flex-col text-right">
                                                    <span className="font-bold text-[#2d3748]">{w.name}</span>
                                                    <span className="text-xs text-gray-500">{w.walletNumber}</span>
                                                </div>
                                                <span className="text-[#3ce619] font-black pl-2">₪{w.currentBalance?.toFixed(2)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {walletCheckResult && (
                                    <div className="w-full bg-[#ecfdf5] border-2 border-[#3ce619]/30 rounded-xl p-6 mb-2 flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-[#3ce619]/20 mb-2">
                                            <span className="material-symbols-outlined text-4xl text-[#3ce619]">wallet</span>
                                        </div>
                                        <h4 className="font-bold text-2xl text-[#166534] text-center w-full">{walletCheckResult.name}</h4>
                                        <div className="text-center w-full mt-2">
                                            <span className="text-gray-500 text-sm block mb-1">יתרה מעודכנת:</span>
                                            <span className="text-4xl font-black text-[#3ce619]">₪{walletCheckResult.currentBalance?.toFixed(2)}</span>
                                        </div>
                                        <div className="flex gap-4 text-sm font-medium w-full justify-center mt-4 bg-white/60 py-2 rounded-lg">
                                            <span className="text-gray-600">ארנק: <span className="font-mono text-[#166534]">{walletCheckResult.walletNumber}</span></span>
                                        </div>
                                    </div>
                                )}

                                <button onClick={() => { setIsWalletCheckOpen(false); setWalletCheckQuery(''); setWalletCheckResult(null); setWalletCheckError(''); }} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl py-4 font-bold text-lg transition-colors mt-auto shrink-0">
                                    סגור חלון
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </>
    );
};

export default POSCheckout;
