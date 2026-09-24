const jwt = require('jsonwebtoken');

// An additional check for the two new mutation flows. Existing authentication
// still supplies the authoritative database role and tenant context.
function verifiedMutation(req, res, next) {
    const authorization = String(req.headers.authorization || '');
    if (!process.env.JWT_SECRET) {
        return res.status(503).json({ error: 'אימות הפעולה אינו זמין כרגע' });
    }
    if (!authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'יש להתחבר מחדש לפני ביצוע הפעולה' });
    }
    try {
        const claims = jwt.verify(authorization.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (!claims || typeof claims !== 'object' || claims.id !== req.user?.id) {
            return res.status(401).json({ error: 'פרטי ההתחברות אינם תואמים' });
        }
        if (claims.environmentId && claims.environmentId !== req.user.environmentId) {
            return res.status(409).json({ error: 'סביבת העבודה השתנתה. יש לרענן את העמוד' });
        }
        if (req.body?.environmentId !== req.user.environmentId) {
            return res.status(409).json({ error: 'סביבת העבודה השתנתה. יש לרענן את העמוד' });
        }
        return next();
    } catch (_error) {
        return res.status(401).json({ error: 'ההתחברות פגה או שאינה תקינה. יש להתחבר מחדש' });
    }
}
module.exports = { verifiedMutation };
