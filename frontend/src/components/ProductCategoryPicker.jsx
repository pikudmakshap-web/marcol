import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ProductCategoryPicker.css';

// Visual treatment reuses Products.jsx's existing category menu: rounded-xl,
// white panel, gray border, shadow-xl, rounded-lg rows and #526f52 selection.
export default function ProductCategoryPicker({ value, onChange, options = [], allowCreate, disabled = false }) {
    const id = useId(), input = useRef(null), menu = useRef(null);
    const [open, setOpen] = useState(false), [query, setQuery] = useState(value || '');
    const [active, setActive] = useState(-1), [position, setPosition] = useState(null);
    const names = [...new Set(options.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
    const filtered = names.filter(name => name.toLocaleLowerCase('he').includes(query.toLocaleLowerCase('he')));
    useEffect(() => { setQuery(value || ''); setActive(-1); }, [value]);
    useEffect(() => {
        if (!open) return;
        const place = () => {
            const rect = input.current?.getBoundingClientRect(); if (!rect) return;
            const roomBelow = window.innerHeight - rect.bottom - 12;
            const above = roomBelow < 160 && rect.top > roomBelow;
            const maxHeight = Math.max(64, Math.min(240, above ? rect.top - 12 : roomBelow));
            const width = Math.min(rect.width, window.innerWidth - 24);
            setPosition({ position: 'fixed', width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
                ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }), maxHeight });
        };
        const outside = e => { if (!input.current?.contains(e.target) && !menu.current?.contains(e.target)) setOpen(false); };
        place(); window.addEventListener('resize', place); document.addEventListener('scroll', place, true); document.addEventListener('pointerdown', outside);
        return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', outside); };
    }, [open]);
    useEffect(() => { if (active >= 0) menu.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
    useEffect(() => { input.current?.setCustomValidity(!allowCreate && !names.includes(value) ? 'יש לבחור קטגוריה קיימת מתוך קטגוריות הארנקים.' : ''); }, [allowCreate, value, options]);
    const choose = name => { onChange(name); setQuery(name); setOpen(false); setActive(-1); input.current?.focus(); };
    return <div className="marcol-product-category">
        <input ref={input} aria-label="קטגוריה" role="combobox" aria-autocomplete="list" aria-expanded={open}
            aria-controls={open ? id : undefined} aria-activedescendant={open && active >= 0 && filtered[active] ? `${id}-${active}` : undefined}
            autoComplete="off" required disabled={disabled} value={query}
            placeholder={allowCreate ? 'הקלד קטגוריה חדשה או בחר קיימת...' : 'בחר קטגוריה קיימת מהארנקים'}
            onFocus={() => { setOpen(true); setActive(-1); }}
            onBlur={e => { if (!menu.current?.contains(e.relatedTarget)) { setOpen(false); if (!allowCreate) setQuery(value || ''); } }}
            onChange={e => { setQuery(e.target.value); setOpen(true); setActive(-1); if (allowCreate) onChange(e.target.value); }}
            onKeyDown={e => {
                if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); if (!allowCreate) setQuery(value || ''); }
                if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); setActive(previous => filtered.length ? Math.max(0, Math.min(filtered.length - 1, previous + (e.key === 'ArrowDown' ? 1 : -1))) : -1); }
                if (e.key === 'Enter' && open) { e.preventDefault(); e.stopPropagation(); if (!e.nativeEvent.isComposing && active >= 0 && filtered[active]) choose(filtered[active]); else if (allowCreate) setOpen(false); }
            }} />
        <span className="material-symbols-outlined marcol-product-category__icon" aria-hidden="true">{allowCreate ? 'edit_note' : 'expand_more'}</span>
        {open && position && createPortal(<div ref={menu} id={id} className="marcol-product-category-menu" role="listbox" aria-label="קטגוריות מוצרים" dir="rtl" style={position}>
            {filtered.map((name, index) => <div key={name} role="option" id={`${id}-${index}`} data-option-index={index}
                aria-selected={name === value} className={(index === active ? 'is-highlighted ' : '') + (name === value ? 'is-selected' : '')}
                onPointerDown={e => e.preventDefault()} onClick={() => choose(name)} onMouseMove={() => setActive(index)}>
                <span>{name}</span>{name === value && <span aria-hidden="true" className="material-symbols-outlined">check</span>}
            </div>)}
            {!filtered.length && <p>{allowCreate && query.trim() ? 'קטגוריה חדשה תיווצר בעת שמירת המוצר.' : 'לא נמצאו קטגוריות מתאימות.'}</p>}
        </div>, document.body)}
    </div>;
}
