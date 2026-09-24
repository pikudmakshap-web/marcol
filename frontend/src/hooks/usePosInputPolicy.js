import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettings } from '../services/settingsService';
import { socket } from '../services/socketService';
export function usePosInputPolicy(environmentId) {
    const [state, setState] = useState({ environmentId: null, loading: true, disabled: true, error: '' });
    const version = useRef(0);
    const reload = useCallback(async () => {
        const request = ++version.current;
        if (!environmentId) { setState({ environmentId, loading: false, disabled: true, error: 'יש לבחור סביבת עבודה' }); return; }
        try {
            const data = await getSettings();
            if (request !== version.current) return;
            if (!environmentId || data.environmentId !== environmentId) throw new Error('Environment changed');
            setState({ environmentId, loading: false, disabled: data.posManualEntryDisabled === true, error: '' });
        } catch (_error) {
            if (request === version.current) setState({ environmentId, loading: false, disabled: true, error: 'ההגדרות לא נטענו; הקלדה ידנית חסומה עד לבדיקה חוזרת' });
        }
    }, [environmentId]);
    useEffect(() => {
        const update = (event) => { if (event?.type === 'settings' && (!event.environmentId || event.environmentId === environmentId)) reload(); };
        const visible = () => { if (document.visibilityState === 'visible') reload(); };
        reload();
        socket.on('data_update', update);
        socket.on('connect', reload);
        window.addEventListener('focus', reload);
        document.addEventListener('visibilitychange', visible);
        return () => {
            version.current += 1;
            socket.off('data_update', update); socket.off('connect', reload);
            window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', visible);
        };
    }, [environmentId, reload]);
    const current = state.environmentId === environmentId;
    return { manualEntryDisabled: !current || state.loading || state.disabled, policyLoading: !current || state.loading,
        policyError: current ? state.error : '', reloadPolicy: reload };
}
