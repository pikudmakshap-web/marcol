const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');

const router = express.Router();
const prisma = new PrismaClient();

// Get active message for the current user
// This finds the most recent active message that the user hasn't read
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Only officers should see global notifications
        if (req.user.role !== 'officer') {
            return res.json(null);
        }

        // Fetch the user to get the latest read status
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { hasReadMessage: true }
        });

        if (!currentUser || currentUser.hasReadMessage) {
            return res.json(null);
        }

        // Find the most recent active message
        const activeMessage = await prisma.systemMessage.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(activeMessage || null);
    } catch (error) {
        console.error('Error fetching active message:', error);
        res.status(500).json({ error: 'Server error fetching messages' });
    }
});

// Get active message regardless of read status (for manual viewing)
router.get('/active/force', authenticateToken, async (req, res) => {
    try {
        const activeMessage = await prisma.systemMessage.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(activeMessage || null);
    } catch (error) {
        console.error('Error fetching forced active message:', error);
        res.status(500).json({ error: 'Server error fetching messages' });
    }
});

// Mark message as read/dismissed
router.post('/:id/dismiss', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id;

        // Check if message exists
        const message = await prisma.systemMessage.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Mark user as having read the message
        await prisma.user.update({
            where: { id: userId },
            data: { hasReadMessage: true }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error dismissing message:', error);
        res.status(500).json({ error: 'Server error dismissing message' });
    }
});

// Create new active message (Admin only)
// Creating a new active message typically implies deactivating older ones
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { title, content } = req.body;

        // Deactivate all existing messages first
        await prisma.systemMessage.updateMany({
            where: { isActive: true },
            data: { isActive: false }
        });

        const newMessage = await prisma.systemMessage.create({
            data: {
                title,
                content,
                isActive: true
            }
        });

        // Flag all users to indicate they have NOT read this new message
        await prisma.user.updateMany({
            data: { hasReadMessage: false }
        });

        // Broadcast to all connected clients that a new message is available
        getIO().emit('system_message_created');

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error creating system message:', error);
        res.status(500).json({ error: 'Server error creating message' });
    }
});

module.exports = router;
