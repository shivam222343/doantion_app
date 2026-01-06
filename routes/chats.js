const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Donation = require('../models/Donation');
const jwt = require('jsonwebtoken');

// Middleware
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// START CHAT (Or Get Existing)
router.post('/start', authMiddleware, async (req, res) => {
    try {
        const { donationId } = req.body;

        if (!donationId) return res.status(400).json({ error: 'Donation ID required' });

        // Check if chat exists
        let chat = await Chat.findOne({
            donationId,
            participants: { $in: [req.user.id] }
        }).populate('participants', 'name email').populate('donationId');

        if (!chat) {
            // Get Donation to find owner
            const donation = await Donation.findById(donationId);
            if (!donation) return res.status(404).json({ error: 'Donation not found' });

            // Prevent chatting with self
            if (donation.donorId.toString() === req.user.id) {
                // Donor cannot start chat with self, they wait for receiver.
                // But if they are viewing their own donation, maybe show list of interested people?
                // For now simpler: Receiver starts chat.
                return res.status(400).json({ error: 'You are the donor.' });
            }

            chat = new Chat({
                participants: [req.user.id, donation.donorId],
                donationId,
                lastMessage: 'Chat started',
            });
            await chat.save();

            // Reload with populate
            chat = await Chat.findById(chat._id).populate('participants', 'name').populate('donationId');
        }

        res.json(chat);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET MESSAGES
router.get('/:chatId/messages', authMiddleware, async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// SEND MESSAGE
router.post('/:chatId/messages', authMiddleware, async (req, res) => {
    try {
        const { content, type = 'text' } = req.body;
        const { chatId } = req.params;

        const message = new Message({
            chatId,
            senderId: req.user.id,
            content,
            type
        });
        await message.save();

        // Update Chat lastMessage
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: content,
            lastMessageAt: Date.now()
        });

        // Emit Socket Event
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('chat:message', message);
            // Also notify participants if needed via notification:new
        }

        res.json(message);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
