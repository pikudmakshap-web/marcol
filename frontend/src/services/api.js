import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const AUTH_STORAGE_KEYS = ['token', 'user'];

function clearAllCookies() {
    if (typeof document === 'undefined') return;
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
        if (!name) continue;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
}

function clearClientStorage() {
    try {
        localStorage.clear();
    } catch (_error) {
        AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    }

    // Preserve only unfinished top-ups, scoped by environment / actor / wallet.
    // Their operation IDs allow a safe retry after re-authentication in this tab.
    const pendingTopUps = [];
    try {
        for (let i = 0; i < sessionStorage.length; i += 1) {
            const key = sessionStorage.key(i);
            if (key?.startsWith('marcol:pending-topup:v1:')) {
                pendingTopUps.push([key, sessionStorage.getItem(key)]);
            }
        }
        sessionStorage.clear();
        for (const [key, value] of pendingTopUps) sessionStorage.setItem(key, value);
    } catch (_error) {
        // Ignore storage access failure; never retry a mutation automatically.
    }
}

function logoutAndRedirectToLogin() {
    const message = 'החיבור אופס. ניקינו את זיכרון האינטרנט במכשיר זה. נא לנסות שוב.';
    clearClientStorage();
    clearAllCookies();
    if (typeof window !== 'undefined') {
        window.alert(message);
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
}

function stripApiPrefix(urlPath) {
    if (!urlPath) return '';
    return urlPath.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api/, '');
}

function isUserRoleAllowedForRequest(config, userRole) {
    if (!config || !userRole) return false;

    const method = String(config.method || 'get').toUpperCase();
    const requestPath = stripApiPrefix(String(config.url || '').split('?')[0] || '');

    const protectedActions = [
        { method: 'POST', pattern: /^\/products\/?$/i, roles: ['admin'] },
        { method: 'PUT', pattern: /^\/products\/[^/]+\/?$/i, roles: ['admin', 'cashier'] },
        { method: 'DELETE', pattern: /^\/products\/[^/]+\/?$/i, roles: ['admin'] },
        { method: 'POST', pattern: /^\/wallets\/?$/i, roles: ['admin', 'officer'] },
        { method: 'PUT', pattern: /^\/wallets\/[^/]+\/?$/i, roles: ['admin', 'officer'] },
        { method: 'DELETE', pattern: /^\/wallets\/[^/]+\/?$/i, roles: ['admin'] },
        { method: 'POST', pattern: /^\/transactions\/?$/i, roles: ['cashier'] },
        { method: 'POST', pattern: /^\/users\/?$/i, roles: ['admin'] },
        { method: 'PUT', pattern: /^\/users\/[^/]+\/?$/i, roles: ['admin'] },
        { method: 'DELETE', pattern: /^\/users\/[^/]+\/?$/i, roles: ['admin'] },
        { method: 'POST', pattern: /^\/messages\/?$/i, roles: ['admin'] },
        { method: 'PUT', pattern: /^\/settings\/?$/i, roles: ['admin'] },
        { method: 'POST', pattern: /^\/environments\/?$/i, roles: ['superadmin'] },
        { method: 'PUT', pattern: /^\/environments\/[^/]+\/?$/i, roles: ['superadmin'] },
        { method: 'DELETE', pattern: /^\/environments\/[^/]+\/?$/i, roles: ['superadmin'] },
        { method: 'POST', pattern: /^\/environments\/[^/]+\/users\/?$/i, roles: ['superadmin'] },
        { method: 'DELETE', pattern: /^\/environments\/[^/]+\/users\/[^/]+\/?$/i, roles: ['superadmin'] }
    ];

    const matchedAction = protectedActions.find((action) => action.method === method && action.pattern.test(requestPath));
    if (!matchedAction) return false;

    return matchedAction.roles.includes(userRole);
}

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor - add token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user && user.id) {
                    config.headers['x-user-id'] = user.id;
                }
            } catch (e) {
                console.error('Error parsing user from localStorage', e);
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const userStr = localStorage.getItem('user');
        let currentUserRole = null;
        try {
            currentUserRole = userStr ? JSON.parse(userStr)?.role : null;
        } catch (_parseError) {
            currentUserRole = null;
        }

        if (status === 401) {
            logoutAndRedirectToLogin();
        } else if (status === 403) {
            const hasMatchingRole = isUserRoleAllowedForRequest(error.config, currentUserRole);
            if (hasMatchingRole) {
                logoutAndRedirectToLogin();
            }
        }
        return Promise.reject(error);
    }
);

export default api;
