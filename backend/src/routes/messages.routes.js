import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

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

        // Find all active messages
        const activeMessages = await prisma.systemMessage.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        if (activeMessages.length === 0) {
            return res.json(null);
        }

        // Check which ones the user has read
        const userReads = await prisma.userMessageRead.findMany({
            where: {
                userId: userId,
                messageId: { in: activeMessages.map(m => m.id) }
            }
        });

        const readMessageIds = new Set(userReads.map(r => r.messageId));

        // Find the first active message the user hasn't read
        const unreadMessage = activeMessages.find(m => !readMessageIds.has(m.id));

        res.json(unreadMessage || null);
    } catch (error) {
        console.error('Error fetching active message:', error);
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

        // Mark as read
        await prisma.userMessageRead.upsert({
            where: {
                userId_messageId: {
                    userId: userId,
                    messageId: messageId
                }
            },
            update: { readAt: new Date() },
            create: {
                userId: userId,
                messageId: messageId
            }
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

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error creating system message:', error);
        res.status(500).json({ error: 'Server error creating message' });
    }
});

export default router;
