export const REPORT_TIME_ZONE = 'Asia/Jerusalem';
const pad = n => String(n).padStart(2, '0');
export function israelDay(value = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(value).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
export function addDays(value, days) {
    const d = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(d.getTime())) throw new Error('תאריך אינו תקין');
    d.setUTCDate(d.getUTCDate() + days);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
// Resolve Israel-local midnight with the actual offset for that date, not the browser timezone.
export function israelMidnight(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('יש לבחור תאריך תקין');
    const wall = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 10) !== value) throw new Error('יש לבחור תאריך תקין');
    let guess = wall;
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    for (let i = 0; i < 4; i++) {
        const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
        const observed = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
        if (observed === wall) return new Date(guess).toISOString();
        guess += wall - observed;
    }
    throw new Error('לא ניתן לקבוע את גבולות היום בזמן ישראל');
}
export function defaults(now = new Date()) {
    const end = israelDay(now);
    return { mode: 'transactions', start: addDays(end, -29), end, q: '', walletIds: [], officerIds: [], cashierIds: [], actorIds: [], productIds: [], categories: [], types: [], status: 'completed', min: '', max: '', includeInactive: false };
}
export function paramsFor(form, environmentId) {
    const from = israelMidnight(form.start), inclusiveEnd = israelMidnight(form.end);
    const to = israelMidnight(addDays(form.end, 1));
    if (Date.parse(from) > Date.parse(inclusiveEnd)) throw new Error('תאריך ההתחלה חייב להיות לפני תאריך הסיום או זהה לו');
    const params = { mode: form.mode, environmentId, from, to, q: form.q, status: form.status, min: form.min, max: form.max, includeInactive: String(form.includeInactive) };
    for (const k of ['walletIds', 'officerIds', 'cashierIds', 'actorIds', 'productIds', 'categories', 'types']) params[k] = JSON.stringify(form[k] || []);
    return params;
}
export const scopeKey = user => `${user?.id || ''}:${user?.role || ''}:${user?.environmentId || ''}`;
