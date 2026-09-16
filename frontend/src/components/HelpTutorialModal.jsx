import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const roleLabels = {
    superadmin: 'מנהל על',
    admin: 'מנהל מערכת',
    officer: 'קצין מלאי',
    cashier: 'קופאי'
};

const TOUR_STEPS = {
    superadmin: [
        { route: '/admin/dashboard', selector: '[data-tour="dashboard-env-switcher"]', title: 'בחירת סביבה פעילה', description: 'כאן מחליפים סביבה. המעבר משנה את כל הנתונים בדפים הניהוליים.', placement: 'left' },
        { route: '/admin/dashboard', selector: '[data-tour="dashboard-main-stats"]', title: 'מדדי ליבה', description: 'האזור הזה מציג תמונת מצב מהירה של יתרות, מלאי וקטגוריות פעילות.', placement: 'bottom' },
        { route: '/admin/dashboard', selector: '[data-tour="dashboard-wallet-usage"]', title: 'שימושים בארנקים', description: 'כאן רואים מי חויב, באיזה ארנק, ומתי בוצעה הפעולה.', placement: 'top' },
        { route: '/admin/environments', selector: '[data-tour="superadmin-overview"]', title: 'סקירת מנהל על', description: 'זה מסך העל של כל הסביבות במערכת עם נתונים רוחביים.', placement: 'left' },
        { route: '/admin/users', selector: '[data-tour="users-header"]', title: 'ניהול משתמשים', description: 'כאן מנהלים משתמשים והרשאות. אפשר ליצור משתמש חדש ולעדכן קיים.', placement: 'left' },
        { route: '/admin/users', selector: '[data-tour="users-table"]', title: 'טבלת משתמשים', description: 'כאן מופיעים כל המשתמשים כולל סטטוס, תפקיד ופעולות עריכה.', placement: 'top' },
        { route: '/admin/products', selector: '[data-tour="products-filters"]', title: 'סינון וחיפוש מוצרים', description: 'מסננים לפי קטגוריה ומחפשים מוצר לפי שם או ברקוד.', placement: 'bottom' },
        { route: '/admin/products', selector: '[data-tour="products-grid"]', title: 'רשימת מוצרים', description: 'כאן אפשר לראות מלאי, מחיר וסטטוס לכל מוצר ולבצע פעולות מהירות.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-header"]', title: 'ניהול ארנקים', description: 'כאן מבצעים חיפוש, פתיחת ארנק חדש וכניסה לניהול מעמיק.', placement: 'left' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-add-button"]', title: 'כפתור הוספת ארנק', description: 'לחיצה כאן פותחת יצירת ארנק חדש. בסיור נפתח עבורך את החלון אוטומטית.', placement: 'left', action: { type: 'click', selector: '[data-tour="wallets-add-button"]' } },
        { route: '/admin/wallets', selector: '[data-tour="wallet-budget-mode-toggle"]', title: 'שני מצבי ארנקים במערכת', description: 'יש שני מצבים: תקציב כללי משותף או תקציבים לפי קטגוריות. מצב המערכת משפיע על כל הארנקים ועל אופן השיוך למוצרים.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallet-general-budget-input"]', title: 'מתי משתמשים בתקציב כללי', description: 'במצב תקציב כללי מזינים סכום אחד כולל לארנק, בלי חלוקה לקטגוריות.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallet-categories-input"]', title: 'מתי בוחרים קטגוריה ומתי כותבים', description: 'במצב קטגוריות: אפשר לבחור קטגוריה קיימת מהרשימה, או לכתוב שם חדש וליצור אותה. לאחר מכן מזינים סכום לכל קטגוריה.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallet-budget-mode-toggle"]', title: 'שינוי מצב ארנקים', description: 'כדי להחליף מצב מערכת (כללי/קטגוריות) חייבים למחוק את כל הארנקים הפעילים. רק אז אפשר לשנות מצב מחדש.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-grid"]', title: 'כרטיסי ארנקים ומחיקה', description: 'בכרטיסי הארנקים אפשר לצפות, לערוך וגם למחוק. מחיקת כל הארנקים מאפשרת להגדיר מחדש את סוג המערכת.', placement: 'top' },
        { route: '/pos/checkout', selector: '[data-tour="pos-actions-panel"]', title: 'מסך קופה', description: 'אזור העבודה בקופה: בחירת קטגוריות, סריקה והוספת מוצרים לעגלה.', placement: 'left' },
        { route: '/pos/checkout', selector: '[data-tour="pos-open-payment"]', title: 'מעבר לתשלום', description: 'לאחר בחירת מוצרים לוחצים כאן ומבצעים חיוב מארנק מתאים.', placement: 'top' },
        { route: '/admin/settings', selector: '[data-tour="settings-panels"]', title: 'הגדרות מערכת', description: 'כאן מנהלים הודעות מערכת והגדרות גלובליות כמו ספי מלאי.', placement: 'top' }
    ],
    admin: [
        { route: '/admin/dashboard', selector: '[data-tour="dashboard-env-switcher"]', title: 'בחירת סביבה פעילה', description: 'כאן מחליפים סביבה. המעבר משנה את כל הנתונים בדפים הניהוליים.', placement: 'left' },
        { route: '/admin/dashboard', selector: '[data-tour="dashboard-quick-actions"]', title: 'פעולות מהירות', description: 'כפתורים חשובים: התראות, הודעות מערכת וכלים ניהוליים.', placement: 'bottom' },
        { route: '/admin/dashboard', selector: '[data-tour="dashboard-main-stats"]', title: 'מדדי ליבה', description: 'האזור הזה מציג תמונת מצב מהירה של יתרות, מלאי וקטגוריות פעילות.', placement: 'bottom' },
        { route: '/admin/users', selector: '[data-tour="users-toolbar"]', title: 'חיפוש וסינון משתמשים', description: 'כאן מחפשים משתמשים ומסננים לפי סטטוס פעילות.', placement: 'bottom' },
        { route: '/admin/users', selector: '[data-tour="users-add-button"]', title: 'הוספת משתמש', description: 'מכאן פותחים חלון יצירת משתמש חדש עם תפקיד והרשאות.', placement: 'left' },
        { route: '/admin/products', selector: '[data-tour="products-filters"]', title: 'סינון מוצרים', description: 'מסנן קטגוריות וחיפוש מוצר לפי שם או ברקוד.', placement: 'bottom' },
        { route: '/admin/products', selector: '[data-tour="products-add-button"]', title: 'הוספת מוצר', description: 'פתיחת טופס מוצר חדש כולל מחיר, מלאי וקטגוריה.', placement: 'left' },
        { route: '/admin/products', selector: '[data-tour="products-grid"]', title: 'רשימת מוצרים', description: 'כרטיסי מוצר עם מחיר, כמות במלאי ופעולות ניהול.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-search"]', title: 'חיפוש ארנקים', description: 'חיפוש לפי שם ארנק, מספר ארנק או מזהה.', placement: 'left' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-add-button"]', title: 'כפתור הוספת ארנק', description: 'מכאן יוצרים ארנק חדש. בסיור נפתח עבורך את החלון אוטומטית.', placement: 'left', action: { type: 'click', selector: '[data-tour="wallets-add-button"]' } },
        { route: '/admin/wallets', selector: '[data-tour="wallet-budget-mode-toggle"]', title: 'שני מצבי ארנקים', description: 'במערכת יש מצב תקציב כללי ומצב תקציבים לפי קטגוריות. הבחירה משפיעה על כל ההתנהגות התקציבית בארנקים.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallet-general-budget-input"]', title: 'מצב תקציב כללי', description: 'בוחרים מצב זה כשצריך סכום אחד כולל לכל הארנק, ללא חלוקה לפי קטגוריות.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallet-categories-input"]', title: 'מצב תקציבים לפי קטגוריות', description: 'במצב זה אפשר לבחור קטגוריה קיימת או להקליד קטגוריה חדשה ואז לקבוע לה תקציב ייעודי.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallet-budget-mode-toggle"]', title: 'מתי אפשר לשנות מצב', description: 'אם קיימים ארנקים פעילים, סוג המערכת ננעל. כדי לשנות בין המצבים צריך למחוק את כל הארנקים ואז להגדיר מחדש.', placement: 'top' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-grid"]', title: 'כרטיסי ארנקים ומחיקה', description: 'כאן רואים את כלל הארנקים וניתן גם למחוק/לערוך. מחיקת כל הארנקים היא תנאי לשינוי סוג מערכת.', placement: 'top' },
        { route: '/pos/checkout', selector: '[data-tour="pos-cart-panel"]', title: 'עגלת קופה', description: 'כאן מצטברים הפריטים שנבחרו כולל כמות, מחיר וסכום סופי.', placement: 'right' },
        { route: '/pos/checkout', selector: '[data-tour="pos-open-payment"]', title: 'חיוב מהיר', description: 'כפתור שמוביל לתהליך חיוב מתוך ארנק הלקוח.', placement: 'top' },
        { route: '/admin/settings', selector: '[data-tour="settings-general-config"]', title: 'הגדרות כלליות', description: 'כאן מגדירים ספים גלובליים ופרמטרים תפעוליים.', placement: 'left' }
    ],
    officer: [
        { route: '/admin/wallets', selector: '[data-tour="wallets-header"]', title: 'ארנקים - מבט על', description: 'זה האזור הראשי לניהול יתרות ארנקים בסביבה הפעילה.', placement: 'left' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-search"]', title: 'חיפוש ארנק', description: 'חפש ארנק במהירות לפי שם או מספר.', placement: 'left' },
        { route: '/admin/wallets', selector: '[data-tour="wallets-grid"]', title: 'רשימת ארנקים', description: 'כאן בוחרים ארנק ומבצעים פעולות ניהול והיסטוריה.', placement: 'top' },
        { route: '/admin/products', selector: '[data-tour="products-filters"]', title: 'חיפוש מוצרים', description: 'סינון המוצרים הרלוונטיים לעבודה השוטפת.', placement: 'bottom' },
        { route: '/admin/products', selector: '[data-tour="products-grid"]', title: 'כרטיסי מוצר', description: 'צפייה במלאי ובסטטוס מוצר כדי לתכנן השלמות.', placement: 'top' }
    ],
    cashier: [
        { route: '/pos/checkout', selector: '[data-tour="pos-actions-panel"]', title: 'עמדת קופה', description: 'כאן מתחילים פעולה: סריקה, בחירה ידנית ובדיקות מהירות.', placement: 'left' },
        { route: '/pos/checkout', selector: '[data-tour="pos-quick-actions"]', title: 'פעולות מהירות', description: 'כפתורי הקלדה ידנית, בדיקת מחיר ובדיקת יתרה.', placement: 'bottom' },
        { route: '/pos/checkout', selector: '[data-tour="pos-category-grid"]', title: 'קטגוריות מוצרים', description: 'בחירה מהירה של קטגוריה כדי להוסיף פריטים לעגלה.', placement: 'top' },
        { route: '/pos/checkout', selector: '[data-tour="pos-cart-items"]', title: 'פריטי העגלה', description: 'כאן ניתן לעדכן כמויות ולהסיר פריטים לפני התשלום.', placement: 'right' },
        { route: '/pos/checkout', selector: '[data-tour="pos-open-payment"]', title: 'מעבר לתשלום', description: 'לאחר בדיקה לוחצים כאן ומבצעים חיוב מהארנק.', placement: 'top' },
        { route: '/admin/products', selector: '[data-tour="products-grid"]', title: 'עיון במוצרים', description: 'ניתן לצפות במלאי כדי לדעת מה זמין למכירה בקופה.', placement: 'top' }
    ]
};

const VIEWPORT_MARGIN = 12;
const HIGHLIGHT_PADDING = 10;
const MIN_TOOLTIP_WIDTH = 300;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getCandidatePosition(targetRect, side, tooltipWidth, tooltipHeight, gap) {
    const targetCenterX = targetRect.left + (targetRect.width / 2);
    const targetCenterY = targetRect.top + (targetRect.height / 2);

    if (side === 'left') {
        return {
            top: targetCenterY - (tooltipHeight / 2),
            left: targetRect.left - tooltipWidth - gap,
            arrowSide: 'right'
        };
    }
    if (side === 'right') {
        return {
            top: targetCenterY - (tooltipHeight / 2),
            left: targetRect.right + gap,
            arrowSide: 'left'
        };
    }
    if (side === 'top') {
        return {
            top: targetRect.top - tooltipHeight - gap,
            left: targetCenterX - (tooltipWidth / 2),
            arrowSide: 'bottom'
        };
    }
    return {
        top: targetRect.bottom + gap,
        left: targetCenterX - (tooltipWidth / 2),
        arrowSide: 'top'
    };
}

function overflowScore(position, tooltipWidth, tooltipHeight, viewportWidth, viewportHeight) {
    const overLeft = Math.max(0, VIEWPORT_MARGIN - position.left);
    const overTop = Math.max(0, VIEWPORT_MARGIN - position.top);
    const overRight = Math.max(0, (position.left + tooltipWidth) - (viewportWidth - VIEWPORT_MARGIN));
    const overBottom = Math.max(0, (position.top + tooltipHeight) - (viewportHeight - VIEWPORT_MARGIN));
    return overLeft + overTop + overRight + overBottom;
}

function getTooltipPosition(targetRect, preferredSide, tooltipSize) {
    if (!targetRect || !tooltipSize?.width || !tooltipSize?.height) {
        return {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            arrowSide: null,
            arrowStyle: {}
        };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 16;
    const tooltipWidth = Math.min(tooltipSize.width, viewportWidth - (VIEWPORT_MARGIN * 2));
    const tooltipHeight = Math.min(tooltipSize.height, viewportHeight - (VIEWPORT_MARGIN * 2));

    const sideOrder = [preferredSide || 'left', 'right', 'left', 'top', 'bottom']
        .filter((value, index, arr) => value && arr.indexOf(value) === index);

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    sideOrder.forEach((side) => {
        const candidate = getCandidatePosition(targetRect, side, tooltipWidth, tooltipHeight, gap);
        const score = overflowScore(candidate, tooltipWidth, tooltipHeight, viewportWidth, viewportHeight);
        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    });

    if (!best) {
        return {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            arrowSide: null,
            arrowStyle: {}
        };
    }

    const top = clamp(best.top, VIEWPORT_MARGIN, viewportHeight - tooltipHeight - VIEWPORT_MARGIN);
    const left = clamp(best.left, VIEWPORT_MARGIN, viewportWidth - tooltipWidth - VIEWPORT_MARGIN);

    const arrowStyle = {};
    if (best.arrowSide === 'left' || best.arrowSide === 'right') {
        const anchorY = targetRect.top + (targetRect.height / 2) - top;
        arrowStyle.top = `${clamp(anchorY, 16, tooltipHeight - 16)}px`;
    } else {
        const anchorX = targetRect.left + (targetRect.width / 2) - left;
        arrowStyle.left = `${clamp(anchorX, 16, tooltipWidth - 16)}px`;
    }

    return {
        top: `${top}px`,
        left: `${left}px`,
        transform: 'none',
        arrowSide: best.arrowSide,
        arrowStyle
    };
}

function HelpTutorialModal({ isOpen, onClose, userRole, currentPath, restartToken = 0, canSwitchEnvironment = false }) {
    const navigate = useNavigate();
    const tooltipRef = useRef(null);
    const executedStepActionsRef = useRef(new Set());
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isResolvingTarget, setIsResolvingTarget] = useState(false);
    const [tooltipSize, setTooltipSize] = useState({ width: MIN_TOOLTIP_WIDTH, height: 240 });
    const [contentAnimClass, setContentAnimClass] = useState('opacity-100 translate-y-0');
    const [lastTooltipPosition, setLastTooltipPosition] = useState({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        arrowSide: null,
        arrowStyle: {}
    });

    const steps = useMemo(() => {
        const roleSteps = TOUR_STEPS[userRole] || [];
        return roleSteps.filter((step) => {
            if (step.selector === '[data-tour="dashboard-env-switcher"]') {
                return canSwitchEnvironment;
            }
            return true;
        });
    }, [userRole, canSwitchEnvironment]);
    const currentStep = steps[currentStepIndex] || null;
    const roleLabel = roleLabels[userRole] || 'משתמש';

    const resolveTarget = (selector) => {
        if (!selector) {
            setTargetRect(null);
            setIsResolvingTarget(false);
            return;
        }

        setIsResolvingTarget(true);
        let attempts = 0;
        const maxAttempts = 35;
        const timer = setInterval(() => {
            attempts += 1;
            const element = document.querySelector(selector);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(() => {
                    setTargetRect(element.getBoundingClientRect());
                    setIsResolvingTarget(false);
                }, 220);
                clearInterval(timer);
                return;
            }

            if (attempts >= maxAttempts) {
                setTargetRect(null);
                setIsResolvingTarget(false);
                clearInterval(timer);
            }
        }, 120);
    };

    useEffect(() => {
        if (!isOpen) return;
        setCurrentStepIndex(0);
        setTargetRect(null);
        setIsResolvingTarget(true);
        executedStepActionsRef.current.clear();
    }, [restartToken, isOpen, steps]);

    useEffect(() => {
        if (!isOpen || !currentStep) return;
        if (!currentPath.startsWith(currentStep.route)) {
            setTargetRect(null);
            setIsResolvingTarget(true);
            navigate(currentStep.route);
            return;
        }

        const actionKey = `${restartToken}:${userRole}:${currentStepIndex}`;
        const action = currentStep.action;
        let actionExecutedNow = false;

        if (action?.type === 'click' && action.selector && !executedStepActionsRef.current.has(actionKey)) {
            const targetButton = document.querySelector(action.selector);
            if (targetButton) {
                targetButton.click();
                executedStepActionsRef.current.add(actionKey);
                actionExecutedNow = true;
            }
        }

        if (actionExecutedNow) {
            setTimeout(() => resolveTarget(currentStep.selector), 260);
        } else {
            resolveTarget(currentStep.selector);
        }
    }, [isOpen, currentStep, currentPath, navigate]);

    useEffect(() => {
        if (!isOpen || !currentStep?.selector) return undefined;

        const refreshRect = () => {
            const element = document.querySelector(currentStep.selector);
            if (element) {
                setTargetRect(element.getBoundingClientRect());
            }
        };

        window.addEventListener('resize', refreshRect);
        window.addEventListener('scroll', refreshRect, true);
        return () => {
            window.removeEventListener('resize', refreshRect);
            window.removeEventListener('scroll', refreshRect, true);
        };
    }, [isOpen, currentStep]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onEsc);
        return () => window.removeEventListener('keydown', onEsc);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || !tooltipRef.current) return;
        const rect = tooltipRef.current.getBoundingClientRect();
        setTooltipSize({ width: rect.width, height: rect.height });
    }, [isOpen, currentStepIndex, isResolvingTarget]);

    useEffect(() => {
        if (!isOpen) return;
        setContentAnimClass('opacity-0 translate-y-1');
        const timer = setTimeout(() => {
            setContentAnimClass('opacity-100 translate-y-0');
        }, 30);
        return () => clearTimeout(timer);
    }, [isOpen, currentStepIndex]);

    const move = (delta) => {
        if (!steps.length) return;
        const next = clamp(currentStepIndex + delta, 0, steps.length - 1);
        setIsResolvingTarget(true);
        setCurrentStepIndex(next);
    };

    const tooltipPosition = getTooltipPosition(targetRect, currentStep?.placement, tooltipSize);
    const isReadyToRenderStep = !!targetRect && !isResolvingTarget;
    const popupPosition = isReadyToRenderStep ? tooltipPosition : lastTooltipPosition;

    useEffect(() => {
        if (!isReadyToRenderStep) return;
        setLastTooltipPosition((prev) => {
            const sameTop = prev.top === tooltipPosition.top;
            const sameLeft = prev.left === tooltipPosition.left;
            const sameTransform = prev.transform === tooltipPosition.transform;
            const sameArrowSide = prev.arrowSide === tooltipPosition.arrowSide;
            const sameArrowTop = prev.arrowStyle?.top === tooltipPosition.arrowStyle?.top;
            const sameArrowLeft = prev.arrowStyle?.left === tooltipPosition.arrowStyle?.left;
            if (sameTop && sameLeft && sameTransform && sameArrowSide && sameArrowTop && sameArrowLeft) {
                return prev;
            }
            return tooltipPosition;
        });
    }, [
        isReadyToRenderStep,
        tooltipPosition.top,
        tooltipPosition.left,
        tooltipPosition.transform,
        tooltipPosition.arrowSide,
        tooltipPosition.arrowStyle?.top,
        tooltipPosition.arrowStyle?.left
    ]);

    if (!isOpen) return null;

    const holeRect = targetRect
        ? {
            top: Math.max(targetRect.top - HIGHLIGHT_PADDING, VIEWPORT_MARGIN),
            left: Math.max(targetRect.left - HIGHLIGHT_PADDING, VIEWPORT_MARGIN),
            width: Math.min(targetRect.width + (HIGHLIGHT_PADDING * 2), window.innerWidth - (VIEWPORT_MARGIN * 2)),
            height: Math.min(targetRect.height + (HIGHLIGHT_PADDING * 2), window.innerHeight - (VIEWPORT_MARGIN * 2))
        }
        : null;

    const holeBottom = holeRect ? holeRect.top + holeRect.height : 0;
    const holeRight = holeRect ? holeRect.left + holeRect.width : 0;

    return (
        <div className="fixed inset-0 z-[100000]" dir="rtl" onClick={onClose}>
            {holeRect && !isResolvingTarget ? (
                <>
                    <div className="fixed pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${holeRect.top}px`, background: 'rgba(15,23,42,0.58)' }} />
                    <div className="fixed pointer-events-none" style={{ top: `${holeRect.top}px`, left: 0, width: `${holeRect.left}px`, height: `${holeRect.height}px`, background: 'rgba(15,23,42,0.58)' }} />
                    <div className="fixed pointer-events-none" style={{ top: `${holeRect.top}px`, left: `${holeRight}px`, right: 0, height: `${holeRect.height}px`, background: 'rgba(15,23,42,0.58)' }} />
                    <div className="fixed pointer-events-none" style={{ top: `${holeBottom}px`, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.58)' }} />

                    <div
                        className="fixed rounded-2xl border-2 border-[#3ce619] pointer-events-none z-[100001]"
                        style={{
                            top: `${holeRect.top}px`,
                            left: `${holeRect.left}px`,
                            width: `${holeRect.width}px`,
                            height: `${holeRect.height}px`,
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                            transition: 'all 220ms ease'
                        }}
                    />
                </>
            ) : (
                <div className="fixed inset-0 bg-slate-900/58 pointer-events-none" />
            )}

            <div
                ref={tooltipRef}
                className="fixed z-[100002] w-[340px] max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-slate-100 shadow-[0_30px_80px_rgba(15,23,42,0.3)] transition-[top,left,transform,opacity] duration-300 ease-out"
                style={{ top: popupPosition.top, left: popupPosition.left, transform: popupPosition.transform }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-100 bg-gradient-to-l from-[#ecfdf5] to-white rounded-t-2xl">
                    <div className="flex items-start justify-between gap-3">
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center"
                            aria-label="סגור לומדה"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                        <div className="text-right">
                            <div className="text-[11px] text-slate-500">לומדה חכמה • {roleLabel}</div>
                            <h3 className="text-base font-black text-slate-800 mt-0.5">{currentStep?.title || 'לומדה'}</h3>
                        </div>
                    </div>
                </div>

                <div className={`p-4 transition-all duration-300 ease-out ${contentAnimClass}`}>
                    {isResolvingTarget ? (
                        <div className="flex items-center gap-3 min-h-[56px]">
                            <div className="w-5 h-5 border-2 border-[#3ce619] border-t-transparent rounded-full animate-spin shrink-0"></div>
                            <div className="text-sm text-slate-700 font-medium">טוען תחנה וממקם הסבר...</div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 leading-relaxed min-h-[56px]">
                            {currentStep?.description || 'אין תיאור זמין לתחנה זו.'}
                        </p>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => move(-1)}
                            disabled={currentStepIndex <= 0 || isResolvingTarget}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            הקודם
                        </button>

                        <span className="text-xs text-slate-500">
                            תחנה {steps.length ? currentStepIndex + 1 : 0} מתוך {steps.length}
                        </span>

                        <button
                            type="button"
                            onClick={() => move(1)}
                            disabled={currentStepIndex >= steps.length - 1 || isResolvingTarget}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            הבא
                        </button>
                    </div>
                </div>

                {popupPosition.arrowSide && !isResolvingTarget && (
                    <span
                        className={`absolute w-3 h-3 bg-white border-slate-100 rotate-45 ${
                            popupPosition.arrowSide === 'left' ? '-left-1.5 border-l border-b' : ''
                        } ${
                            popupPosition.arrowSide === 'right' ? '-right-1.5 border-r border-t' : ''
                        } ${
                            popupPosition.arrowSide === 'top' ? '-top-1.5 border-t border-l' : ''
                        } ${
                            popupPosition.arrowSide === 'bottom' ? '-bottom-1.5 border-b border-r' : ''
                        }`}
                        style={popupPosition.arrowStyle}
                    />
                )}
            </div>
        </div>
    );
}

export default HelpTutorialModal;
