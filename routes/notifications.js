const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

// Auth middleware
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

// GET ALL NOTIFICATIONS
router.get('/', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            userId: req.user.id,
            read: false
        });

        res.json({
            notifications,
            unreadCount
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// MARK NOTIFICATION AS READ
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notification.read = true;
        await notification.save();

        const unreadCount = await Notification.countDocuments({
            userId: req.user.id,
            read: false
        });

        res.json({ success: true, unreadCount });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// MARK ALL AS READ
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, read: false },
            { read: true }
        );

        res.json({ success: true, unreadCount: 0 });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// CLEAR ALL NOTIFICATIONS
router.delete('/delete-all', authMiddleware, async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user.id });

        res.json({ success: true, unreadCount: 0 });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE NOTIFICATION
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const unreadCount = await Notification.countDocuments({
            userId: req.user.id,
            read: false
        });

        res.json({ success: true, unreadCount });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
