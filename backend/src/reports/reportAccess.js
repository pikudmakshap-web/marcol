'use strict';
const jwt = require('jsonwebtoken');
const { usersPrisma, controlPrisma, getTenantPrismaByDbName } = require('../config/database');
// Read-only: deliberately does NOT call the legacy tenant bootstrap middleware.
async function reportAccess(req, res, next) {
    try {
        if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'אימות הדוח אינו זמין' });
        const header = String(req.headers.authorization || '');
        if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'נדרשת התחברות' });
        let claims;
        try { claims = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
        catch { return res.status(401).json({ error: 'ההתחברות אינה תקינה או שפגה' }); }
        if (!claims || typeof claims !== 'object' || !/^[a-f\d]{24}$/i.test(claims.id || '') || claims.id !== req.headers['x-user-id']) return res.status(401).json({ error: 'פרטי ההתחברות אינם תואמים' });
        const user = await usersPrisma.user.findUnique({ where: { id: claims.id }, select: { id: true, fullName: true, role: true, isActive: true, environmentId: true } });
        if (!user?.isActive) return res.status(403).json({ error: 'אין הרשאה לדוחות' });
        if (!user.environmentId) return res.status(400).json({ error: 'יש לבחור סביבת עבודה לפני הפקת דוח' });
        if (req.query.environmentId !== user.environmentId || (claims.environmentId && claims.environmentId !== user.environmentId)) return res.status(409).json({ error: 'סביבת העבודה השתנתה; יש לרענן את הדוח' });
        let role = user.role;
        if (role !== 'superadmin') {
            const member = await usersPrisma.userEnvironment.findUnique({ where: { userId_environmentId: { userId: user.id, environmentId: user.environmentId } }, select: { role: true } });
            if (!member) return res.status(403).json({ error: 'אין הרשאה לסביבה' });
            if (role !== 'admin') role = member.role;
        }
        if (!['admin', 'superadmin'].includes(role)) return res.status(403).json({ error: 'הדוחות זמינים למנהלים בלבד' });
        const environment = await controlPrisma.environment.findUnique({ where: { id: user.environmentId }, select: { id: true, name: true, dbName: true, isActive: true } });
        if (!environment?.isActive || !environment.dbName) return res.status(409).json({ error: 'סביבת העבודה אינה מוכנה או אינה פעילה' });
        req.user = { ...user, role }; req.reportEnvironment = environment;
        req.envPrisma = getTenantPrismaByDbName(environment.dbName); req.usersPrisma = usersPrisma;
        res.set('Cache-Control', 'no-store');
        return next();
    } catch (error) { return next(error); }
}
module.exports = { reportAccess };
