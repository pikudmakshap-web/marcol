const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { usersPrisma } = require('../config/database.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');
const { getEnvironmentUserIds } = require('../utils/userLookup.js');

const router = express.Router();

// Get active message for the current user
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const userId = req.user.id;

        const currentUser = await usersPrisma.user.findUnique({
            where: { id: userId },
            select: { hasReadMessage: true }
        });

        if (!currentUser || currentUser.hasReadMessage) {
            return res.json(null);
        }

        const activeMessage = await tenantPrisma.systemMessage.findFirst({
            where: { isActive: true, environmentId: req.user.environmentId },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(activeMessage || null);
    } catch (error) {
        console.error('Error fetching active message:', error);
        return res.status(500).json({ error: 'Server error fetching messages' });
    }
});

// Get active message regardless of read status
router.get('/active/force', authenticateToken, async (req, res) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const activeMessage = await tenantPrisma.systemMessage.findFirst({
            where: { isActive: true, environmentId: req.user.environmentId },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(activeMessage || null);
    } catch (error) {
        console.error('Error fetching forced active message:', error);
        return res.status(500).json({ error: 'Server error fetching messages' });
    }
});

// Mark message as read/dismissed
router.post('/:id/dismiss', authenticateToken, async (req, res) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const messageId = req.params.id;
        const userId = req.user.id;

        const message = await tenantPrisma.systemMessage.findUnique({
            where: { id: messageId }
        });

        if (!message || message.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Message not found' });
        }

        await usersPrisma.user.updateMany({
            where: { id: userId },
            data: { hasReadMessage: true }
        });

        return res.json({ success: true });
    } catch (error) {
        console.error('Error dismissing message:', error);
        return res.status(500).json({ error: 'Server error dismissing message' });
    }
});

// Create new active message (Admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { title, content } = req.body;

        await tenantPrisma.systemMessage.updateMany({
            where: { isActive: true, environmentId: req.user.environmentId },
            data: { isActive: false }
        });

        const newMessage = await tenantPrisma.systemMessage.create({
            data: {
                title,
                content,
                isActive: true,
                environmentId: req.user.environmentId
            }
        });

        const environmentUserIds = await getEnvironmentUserIds(usersPrisma, req.user.environmentId);
        if (environmentUserIds.length > 0) {
            await usersPrisma.user.updateMany({
                where: { id: { in: environmentUserIds } },
                data: { hasReadMessage: false }
            });
        }

        getIO().emit('system_message_created');
        return res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error creating system message:', error);
        return res.status(500).json({ error: 'Server error creating message' });
    }
});

module.exports = router;
