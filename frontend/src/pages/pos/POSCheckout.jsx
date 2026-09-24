import { useState, useEffect, useCallback, useRef } from 'react';
import { useProductStore } from '../../store/productStore';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { searchWallets } from '../../services/walletService';
import { createTransaction } from '../../services/transactionService';
import toast from 'react-hot-toast';
import ProductImage from '../../components/ProductImage';
import { useAuthStore } from '../../store/authStore';
import { usePosInputPolicy } from '../../hooks/usePosInputPolicy';
import { createScanCollector } from '../../utils/posScanner.mjs';


const POSCheckout = () => {
    const navigate = useNavigate();
    const outletContext = useOutletContext() || {};
    const onHelpClick = outletContext.onHelpClick;
    const { user: currentUser } = useAuthStore();
    const isCashierView = currentUser?.role === 'cashier';
    const { manualEntryDisabled, policyLoading, policyError, reloadPolicy } = usePosInputPolicy(currentUser?.environmentId);
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
    const { products, loading, isLoaded, hasMore, fetchProducts } = useProductStore();

    useEffect(() => {
        if (!isLoaded || hasMore) {
            fetchProducts({ force: true, reset: true, all: true });
        }
    }, [fetchProducts, isLoaded, hasMore]);

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
    const [selectedOfficerId, setSelectedOfficerId] = useState(null);
    const [isOfficerMenuOpen, setIsOfficerMenuOpen] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const officerMenuRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const fetchPaymentWallets = async () => {
            if (!paymentQuery) {
                setPaymentWallets([]);
                setSelectedWallet(null);
                setPaymentError('');
                return;
            }
            try {
                const results = await searchWallets(paymentQuery);
                if (cancelled) return;
                setPaymentWallets(results);
                if (results.length === 0) {
                    setSelectedWallet(null);
                    setSelectedOfficerId(null);
                } else if (results.length === 1) {
                    const w = results[0];
                    setSelectedWallet(w);
                    setSelectedOfficerId(w.walletUsers?.length === 1 ? w.walletUsers[0].user.id : null);
                } else {
                    setSelectedWallet(null);
                    setSelectedOfficerId(null);
                }
            } catch (err) {
                if (!cancelled) setPaymentError(err.response?.data?.error || 'שגיאה בחיפוש ארנק');
            }
        };

        const timer = setTimeout(fetchPaymentWallets, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [paymentQuery]);

    useEffect(() => {
        let cancelled = false;
        const fetchCheckWallets = async () => {
            if (!walletCheckQuery) {
                setWalletCheckWallets([]);
                setWalletCheckResult(null);
                setWalletCheckError('');
                return;
            }
            try {
                const results = await searchWallets(walletCheckQuery);
                if (cancelled) return;
                setWalletCheckWallets(results);
                if (results.length === 0) setWalletCheckResult(null);
                else if (results.length === 1) setWalletCheckResult(results[0]);
                else setWalletCheckResult(null);
            } catch (err) {
                if (!cancelled) setWalletCheckError(err.response?.data?.error || 'שגיאה בחיפוש ארנק');
            }
        };

        const timer = setTimeout(fetchCheckWallets, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [walletCheckQuery]);

    useEffect(() => {
        if (!isOfficerMenuOpen) return;
        const handleOutsideClick = (event) => {
            if (officerMenuRef.current && !officerMenuRef.current.contains(event.target)) {
                setIsOfficerMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isOfficerMenuOpen]);

    useEffect(() => {
        setIsOfficerMenuOpen(false);
    }, [selectedWallet?.id]);

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
        let officerId = selectedOfficerId;

        if (!officerId && selectedWallet.walletUsers?.length === 1) {
            officerId = selectedWallet.walletUsers[0].user.id;
        }

        if (!officerId) {
            setPaymentError('יש לבחור את מקבל המוצרים לפני השלמת העסקה');
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
                officerSelectionConfirmed: true,
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

    // This listener exists only while the checkout page is mounted. Read-only
    // fields receive a completed scan through React state, not individual keys.
    useEffect(() => {
        if (!manualEntryDisabled) return;
        const collector = createScanCollector();
        const scan = (event) => {
            const target = event.target;
            const inCheckout = target?.closest?.('[data-pos-input-guard]');
            const pageBody = target === document.body || target === document.documentElement;
            if (!inCheckout && !pageBody) { collector.reset(); return; }
            const value = collector.push(event, performance.now());
            if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault();
            if (!value) return;
            event.preventDefault(); event.stopPropagation();
            if (policyLoading || policyError) { toast.error('יש לטעון את הגדרות הקופה לפני הסריקה'); return; }
            if (isPaymentModalOpen) { setPaymentQuery(value); return; }
            if (isWalletCheckOpen) { setWalletCheckQuery(value); return; }
            if (isPriceCheckOpen) { setPriceCheckQuery(value); return; }
            if (isManualBarcodeOpen || isCategoriesModalOpen) return;
            const product = products.find((item) => item.barcode === value);
            if (product) handleAddToCart(product);
            else toast.error(`לא נמצא מוצר עם ברקוד ${value}`);
        };
        window.addEventListener('keydown', scan, true);
        return () => { window.removeEventListener('keydown', scan, true); collector.reset(); };
    }, [manualEntryDisabled, policyLoading, policyError, products, isPaymentModalOpen, isWalletCheckOpen, isPriceCheckOpen, isManualBarcodeOpen, isCategoriesModalOpen, handleAddToCart]);
    useEffect(() => {
        if (manualEntryDisabled) {
            setIsManualBarcodeOpen(false); setManualBarcodeQuery('');
            setPaymentQuery(''); setSelectedWallet(null); setSelectedOfficerId(null); setPaymentWallets([]);
            setPriceCheckQuery(''); setWalletCheckQuery(''); setWalletCheckResult(null); setWalletCheckWallets([]);
        }
    }, [manualEntryDisabled, currentUser?.environmentId]);
    const blockManualTransfer = (event) => {
        if (manualEntryDisabled && event.target?.matches?.('input, textarea, [contenteditable="true"]')) event.preventDefault();
    };

    const barcodeBufferRef = useRef('');
    const lastKeyTimeRef = useRef(Date.now());

    // Global Barcode Scanner Listener
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (manualEntryDisabled) { barcodeBufferRef.current = ''; return; }
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
    }, [manualEntryDisabled, products, isPaymentModalOpen, isCategoriesModalOpen, isManualBarcodeOpen, isPriceCheckOpen, isWalletCheckOpen, handleAddToCart]);

    const totalItems = orderItems.reduce((sum, item) => sum + (item.qty === '' ? 0 : item.qty), 0);
    const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * (item.qty === '' ? 0 : item.qty)), 0);

    // Wallet Breakdown Logic
    const isCatWallet = selectedWallet?.categoryBalances?.length > 0;
    const catUsage = {};
    let hasWalletError = false;
    let walletErrorMsg = '';

    if (selectedWallet) {
        if (isCatWallet) {
            orderItems.forEach(item => {
                const cat = item.category || 'ללא קטגוריה';
                catUsage[cat] = (catUsage[cat] || 0) + (item.price * (item.qty === '' ? 0 : item.qty));
            });
            for (const catName in catUsage) {
                const cost = catUsage[catName];
                const walletCat = selectedWallet.categoryBalances.find(c => c.categoryName === catName);
                if (!walletCat) {
                    hasWalletError = true;
                    walletErrorMsg = `אין הרשאה לקטגוריה '${catName}' בארנק`;
                } else if (cost > walletCat.balance) {
                    hasWalletError = true;
                    walletErrorMsg = `חריגה ביתרת סטטוס '${catName}'`;
                }
            }
        } else {
            if (totalPrice > selectedWallet.currentBalance) {
                hasWalletError = true;
                walletErrorMsg = 'אין מספיק יתרה בארנק';
            }
        }
    }

    return (
        <div data-pos-input-guard onPasteCapture={blockManualTransfer} onDropCapture={blockManualTransfer} onBeforeInputCapture={blockManualTransfer}>
            {(manualEntryDisabled || policyError) && <div role="status" className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm mb-2" dir="rtl">
                {policyLoading ? 'טוען הגדרות קופה...' : policyError || 'הקלדה ידנית חסומה בקופה. סריקה, בחירת מוצרים וכפתורי הכמות נשארים פעילים.'}
                {policyError && <button type="button" className="underline mr-3" onClick={reloadPolicy}>נסה שוב</button>}
            </div>}
            <div className="flex flex-col lg:flex-row-reverse gap-4 h-[calc(100vh-5rem)] max-w-[1600px] mx-auto p-2 font-sans overflow-hidden" data-tour="pos-page">

                {/* Left Column: Order Summary (Receipt) */}
                <div className="flex-[1.2] bg-white rounded-[24px] shadow-sm border border-gray-100 flex flex-col overflow-hidden relative" data-tour="pos-cart-panel">

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 p-4 bg-gray-50 border-b border-gray-100 text-[#a0aec0] font-bold text-sm text-center">
                        <div className="col-span-4 text-right pr-4">שם פריט</div>
                        <div className="col-span-3">כמות</div>
                        <div className="col-span-2">מחיר</div>
                        <div className="col-span-2">סה"כ</div>
                        <div className="col-span-1 text-right"></div> {/* Delete Button Space */}
                    </div>

                    {/* Items List */}
                    <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 ${orderItems.length > 0 ? 'custom-scrollbar' : ''}`} data-tour="pos-cart-items">
                        {orderItems.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center py-3 border-b border-dashed border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors rounded-xl group">
                                <div className="col-span-4 flex items-center gap-3 pr-4 text-sm font-bold text-[#2d3748]">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                                        <ProductImage
                                            src={item.imageUrl}
                                            productId={item.id || item.productId}
                                            alt={item.name}
                                            imageClassName="w-full h-full object-cover"
                                        />
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
                                        readOnly={manualEntryDisabled}
                                        inputMode={manualEntryDisabled ? 'none' : undefined}
                                        aria-readonly={manualEntryDisabled}
                                        type="number"
                                        min="1"
                                        value={item.qty === '' ? '' : item.qty}
                                        onChange={(e) => {
                                            if (manualEntryDisabled) return;
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
                            data-tour="pos-open-payment"
                        >
                            <span className="material-symbols-outlined text-3xl font-bold">eco</span>
                            לתשלום
                        </button>
                    </div>
                </div>

                {/* Right Column: Interaction / Kiosk Display */}
                <div className="flex-1 bg-[#bbf7d0] rounded-[24px] shadow-lg flex flex-col p-6 lg:p-10 relative overflow-hidden text-[#166534] h-full justify-center border border-[#86efac]" data-tour="pos-actions-panel">
                    {isCashierView && (
                        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/products')}
                                className="w-10 h-10 rounded-full bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#166534] border border-[#3ce619]/20 shadow-sm flex items-center justify-center transition-colors"
                                title="מעבר למוצרים"
                            >
                                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onHelpClick?.()}
                                className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#166534] border border-[#3ce619]/20 shadow-sm flex items-center justify-center transition-colors"
                                title="עזרה"
                            >
                                <span className="material-symbols-outlined text-[22px]">help</span>
                            </button>
                        </div>
                    )}

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
                                <h1 className="text-4xl lg:text-5xl font-black text-[#62ba50] tracking-tight mb-8 flex flex-col items-center justify-center gap-4 drop-shadow-sm">
                                    <div className="w-20 h-20 bg-[#ecfdf5] rounded-full mt-2 flex items-center justify-center shadow-inner border border-[#3ce619]/10">
                                        <span className="material-symbols-outlined text-[3rem]">eco</span>
                                    </div>
                                    סרוק את הברקוד
                                </h1>

                                {/* Action Buttons underneath */}
                                <div className="flex flex-wrap justify-center gap-3 mb-8 w-full max-w-lg" data-tour="pos-quick-actions">
                                    <button disabled={manualEntryDisabled} title={manualEntryDisabled ? 'הקלדה ידנית חסומה בהגדרות' : 'הקלדת פריט'} onClick={() => { if (!manualEntryDisabled) setIsManualBarcodeOpen(true); }} className="flex-1 min-w-[140px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#3ce619] py-4 px-2 rounded-full font-bold text-sm sm:text-base transition-transform hover:scale-105 border-2 border-[#3ce619]/20 shadow-sm flex flex-col items-center justify-center gap-1">
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
                                    <div className="flex flex-col gap-3 pb-4 pr-1 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar">
                                        {categoryProducts.map(product => {
                                            console.log(product);

                                            const safePrice = product?.unitPrice ? Number(product.unitPrice) : 0;
                                            const outOfStock = (product.quantity || 0) <= 0;
                                            return (
                                                <button key={product.id} onClick={() => !outOfStock && handleAddToCart(product)} className={`bg-white border rounded-2xl p-4 min-h-[88px] shrink-0 flex items-center justify-between transition-transform shadow-sm text-right w-full relative overflow-hidden ${outOfStock ? 'opacity-70 cursor-not-allowed border-gray-200 bg-gray-50/50' : 'hover:bg-gray-50 border-white/50 hover:scale-[1.02] text-[#166534]'}`}>
                                                    {/* Product Details (Right) */}
                                                    <div className={`flex items-center gap-4 overflow-hidden flex-1 pl-2 ${outOfStock ? 'opacity-40' : ''}`}>
                                                        <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border ${outOfStock ? 'border-gray-200' : 'border-gray-100'}`}>
                                                            <ProductImage
                                                                src={product.imageUrl}
                                                                productId={product.id}
                                                                alt={product.name}
                                                                imageClassName={`w-full h-full object-cover ${outOfStock ? 'grayscale opacity-50' : ''}`}
                                                                placeholderClassName={outOfStock ? 'opacity-40' : ''}
                                                            />
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className={`font-bold text-base sm:text-lg leading-tight truncate px-1 ${outOfStock ? 'text-gray-500' : ''}`}>{product.name}</span>
                                                            <span className="text-sm text-gray-400 px-1 truncate">{product.sku ? `מק"ט: ${product.sku}` : 'אין מק"ט'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Price (Left) */}
                                                    <div className={`shrink-0 text-left flex flex-col items-end gap-1 ${outOfStock ? 'opacity-40' : ''}`}>
                                                        <span className={`px-4 py-1.5 rounded-full font-black text-xl border ${outOfStock ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-[#ecfdf5] text-[#166534] border-[#3ce619]/20'}`}>₪{safePrice.toFixed(2)}</span>
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
                                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto w-full z-10 pb-4" data-tour="pos-category-grid">
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
                                        readOnly={manualEntryDisabled}
                                        inputMode={manualEntryDisabled ? 'none' : undefined}
                                        aria-readonly={manualEntryDisabled}
                                    type="text"
                                    placeholder="הקש פריט / ברקוד כאן..."
                                    autoFocus
                                    value={manualBarcodeQuery}
                                    onChange={(e) => { if (!manualEntryDisabled) setManualBarcodeQuery(e.target.value); }}
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
                                                            <div className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm ${outOfStock ? 'border border-gray-200' : 'border border-gray-100'}`}>
                                                                <ProductImage
                                                                    src={p.imageUrl}
                                                                    productId={p.id}
                                                                    alt={p.name}
                                                                    imageClassName={`w-full h-full object-contain p-1 ${outOfStock ? 'grayscale opacity-50' : ''}`}
                                                                    placeholderClassName={outOfStock ? 'opacity-40' : ''}
                                                                />
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
                                        readOnly={manualEntryDisabled}
                                        inputMode={manualEntryDisabled ? 'none' : undefined}
                                        aria-readonly={manualEntryDisabled}
                                        type="text"
                                        placeholder={manualEntryDisabled ? 'סרוק ברקוד' : 'הקלד שם ארנק / מספר אישי פריט או ברקוד...'}
                                        autoFocus
                                        value={paymentQuery}
                                        onChange={(e) => { if (!manualEntryDisabled) setPaymentQuery(e.target.value); }}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-center font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3ce619] focus:border-transparent transition-all pr-12 text-sm"
                                    />
                                    <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-[#166534] hover:bg-gray-50">
                                        <span className="material-symbols-outlined">search</span>
                                    </button>
                                </form>

                                {paymentError && (
                                    <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-bold mb-4">
                                        {paymentError}
                                    </div>
                                )}

                                {paymentWallets.length > 1 && !selectedWallet && (
                                    <div className="w-full max-h-[30vh] overflow-y-auto flex flex-col gap-2 custom-scrollbar pr-2 mb-4">
                                        <div className="text-sm font-bold text-gray-500 mb-2">נמצאו מספר ארנקים, בחר אחד:</div>
                                        {paymentWallets.map(w => (
                                            <button key={w.id} onClick={() => { setSelectedWallet(w); setSelectedOfficerId(w.walletUsers?.length === 1 ? w.walletUsers[0].user.id : null); }} className="flex justify-between items-center bg-gray-50 hover:bg-[#ecfdf5] border border-gray-200 hover:border-[#3ce619]/50 p-4 rounded-xl transition-colors w-full text-right">
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
                                        <div className="flex gap-4 text-sm font-medium w-full justify-center mb-2">
                                            <span className="text-gray-600">יתרת ארנק כוללת: <span className="text-[#166534] font-bold">₪{selectedWallet.currentBalance?.toFixed(2)}</span></span>
                                        </div>

                                        {/* Select Officer */}
                                        {selectedWallet.walletUsers?.length > 0 && (
                                            <div className="w-full mt-2 relative">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <label className="text-sm font-bold text-[#166534]">משתמש לחיוב</label>
                                                    <span className="text-xs text-[#166534]/70 bg-[#166534]/10 px-2 py-0.5 rounded-full font-medium">(נדרש לאישור העסקה)</span>
                                                </div>
                                                <div className="relative" ref={officerMenuRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsOfficerMenuOpen((prev) => !prev)}
                                                        className="w-full bg-white/95 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#166534] focus:outline-none focus:ring-2 focus:ring-[#3ce619]/35 focus:border-[#3ce619]/45 transition-all cursor-pointer hover:bg-gray-50 shadow-[0_8px_22px_rgba(15,23,42,0.08)] text-right"
                                                    >
                                                        {(() => {
                                                            const selectedOfficer = selectedWallet.walletUsers.find((wu) => wu.user.id === selectedOfficerId)?.user;
                                                            if (!selectedOfficer) return 'בחר משתמש לחיוב';
                                                            return `${selectedOfficer.fullName} (${selectedOfficer.personalNumber || selectedOfficer.barcode})`;
                                                        })()}
                                                    </button>
                                                    <div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none text-[#3ce619]">
                                                        <span className={`material-symbols-outlined text-[22px] transition-transform duration-200 ${isOfficerMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                                    </div>

                                                    {isOfficerMenuOpen && (
                                                        <div className="absolute top-full mt-1 w-full bg-white border border-[#3ce619]/30 rounded-2xl shadow-[0_14px_30px_rgba(15,23,42,0.15)] p-2 z-[10050] max-h-[112px] overflow-y-auto custom-scrollbar">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedOfficerId(null);
                                                                    setIsOfficerMenuOpen(false);
                                                                }}
                                                                className={`w-full text-right px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${!selectedOfficerId ? 'bg-[#3ce619] text-white' : 'text-[#166534] hover:bg-[#ecfdf5]'}`}
                                                            >
                                                                בחר משתמש לחיוב
                                                            </button>
                                                            {selectedWallet.walletUsers.map((wu) => (
                                                                <button
                                                                    key={wu.user.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedOfficerId(wu.user.id);
                                                                        setIsOfficerMenuOpen(false);
                                                                    }}
                                                                    className={`w-full text-right px-3 py-2.5 rounded-xl font-bold text-sm transition-colors mt-1 ${selectedOfficerId === wu.user.id ? 'bg-[#3ce619] text-white' : 'text-[#166534] hover:bg-[#ecfdf5]'}`}
                                                                >
                                                                    {wu.user.fullName} ({wu.user.personalNumber || wu.user.barcode})
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {isCatWallet && (
                                            <div className="w-full mt-2 border-t border-[#3ce619]/20 pt-3 flex flex-col gap-2">
                                                <div className="text-sm font-bold text-[#166534] mb-1">פירוט התפלגות קטגוריות לעסקה זו:</div>
                                                {Object.keys(catUsage).map(catName => {
                                                    const cost = catUsage[catName];
                                                    const walletCat = selectedWallet.categoryBalances.find(c => c.categoryName === catName);
                                                    const catBal = walletCat ? walletCat.balance : 0;
                                                    const exceeded = !walletCat || cost > catBal;
                                                    return (
                                                        <div key={catName} className="flex justify-between items-center text-sm">
                                                            <span className="text-gray-700">{catName} {exceeded && <span className="text-red-500 font-bold ml-1">(חריגת יתרה)</span>}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className={exceeded ? 'text-red-600 font-bold' : 'text-gray-800 font-bold'}>₪{cost.toFixed(2)}-</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleCheckout}
                                    disabled={!selectedWallet || isProcessing || hasWalletError}
                                    className="w-full bg-[#3ce619] hover:bg-[#32c914] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl py-4 font-black text-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                                >
                                    {isProcessing ? 'מעבד...' : (!selectedWallet ? 'בצע חיוב מתוך הארנק' : (hasWalletError ? walletErrorMsg : 'בצע חיוב מתוך הארנק'))}
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
                                        readOnly={manualEntryDisabled}
                                        inputMode={manualEntryDisabled ? 'none' : undefined}
                                        aria-readonly={manualEntryDisabled}
                                    type="text"
                                    placeholder={manualEntryDisabled ? 'סרוק ברקוד' : 'דוגמא: ארנק מחלקה / מ.א קצין 🔍'}
                                    autoFocus
                                    value={priceCheckQuery}
                                    onChange={(e) => { if (!manualEntryDisabled) setPriceCheckQuery(e.target.value); }}
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
                                                            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                                                                <ProductImage
                                                                    src={p.imageUrl}
                                                                    productId={p.id}
                                                                    alt={p.name}
                                                                    imageClassName={`w-full h-full object-contain drop-shadow-sm mix-blend-multiply ${outOfStock ? 'grayscale opacity-60' : ''}`}
                                                                    placeholderClassName={outOfStock ? 'opacity-50' : ''}
                                                                />
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
                                        readOnly={manualEntryDisabled}
                                        inputMode={manualEntryDisabled ? 'none' : undefined}
                                        aria-readonly={manualEntryDisabled}
                                        type="text"
                                        placeholder={manualEntryDisabled ? 'סרוק ברקוד' : 'הקלד או סרוק ברקוד ולחץ אנטר...'}
                                        autoFocus
                                        value={walletCheckQuery}
                                        onChange={(e) => { if (!manualEntryDisabled) setWalletCheckQuery(e.target.value); }}
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

        </div>
    );
};

export default POSCheckout;

