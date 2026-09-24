import { useEffect, useId, useRef, useState } from 'react';
import api from '../services/api';

const FORMAT_ERROR = 'בברקוד ניתן להזין ספרות בלבד, ללא אותיות או סימנים.';
const validPartial = value => typeof value === 'string' && /^[0-9]{0,128}$/.test(value);

/** A barcode is text made of digits, never a JavaScript number. */
export default function BarcodeInput({ value, onChange, entity, entityId, environmentId, onKeyDown, onPaste, onBeforeInput, onCommit, ...props }) {
    const id = useId();
    const [inputError, setInputError] = useState('');
    const [availability, setAvailability] = useState(null);
    const version = useRef(0);
    const signature = [entity, entityId, environmentId, value].join('|');
    useEffect(() => {
        const attempt = ++version.current;
        setAvailability(null);
        if (!entity || !environmentId || !validPartial(value) || !value) return;
        let alive = true;
        const timer = setTimeout(async () => {
            setAvailability({ signature, checking: true });
            try {
                const { data } = await api.get('/products/barcode-availability', { params: { value, kind: entity, ...(entityId ? { excludeId: entityId } : {}) } });
                if (alive && version.current === attempt && data.environmentId === environmentId) {
                    setAvailability({ signature, message: data.available ? '' : data.message });
                }
            } catch (_error) {
                if (alive && version.current === attempt) setAvailability({ signature, warning: 'בדיקת הזמינות לא הושלמה. השרת יבדוק שוב בעת השמירה.' });
            }
        }, 350);
        return () => { alive = false; clearTimeout(timer); };
    }, [signature, entity, entityId, environmentId, value]);
    const current = availability?.signature === signature ? availability : null;
    const message = inputError || current?.message || '';
    const hint = message || (current?.checking ? 'בודק זמינות ברקוד...' : current?.warning || '');
    const reject = e => { e.preventDefault(); setInputError(FORMAT_ERROR); };
    return <>
        <input {...props} value={value} type="text" inputMode={props.readOnly ? 'none' : 'numeric'} pattern="[0-9]+" maxLength={128}
            autoComplete="off" spellCheck={false} aria-invalid={message ? true : undefined} aria-describedby={hint ? id : props['aria-describedby']}
            onBeforeInput={e => {
                onBeforeInput?.(e);
                if (e.data && !/^[0-9]*$/.test(e.data)) reject(e);
            }}
            onPaste={e => {
                onPaste?.(e);
                if (!validPartial(e.clipboardData.getData('text'))) reject(e);
            }}
            onKeyDown={e => {
                if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !/^[0-9]$/.test(e.key)) { reject(e); return; }
                if (e.key === 'Enter' && onCommit) { e.preventDefault(); e.stopPropagation(); if (!e.repeat && !e.nativeEvent?.isComposing) onCommit(); return; }
                onKeyDown?.(e);
            }}
            onChange={e => {
                if (props.readOnly || props.disabled) return;
                if (!validPartial(e.target.value)) { setInputError(FORMAT_ERROR); return; }
                setInputError(''); onChange?.(e);
            }} />
        {hint && <p id={id} role="status" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0', color: message ? '#b42318' : '#697769' }}>{hint}</p>}
    </>;
}
