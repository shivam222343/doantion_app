const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Donation = require('../models/Donation');
const DonationRequest = require('../models/DonationRequest');
const { checkAndAwardBadges } = require('../utils/badgeHelper');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware to verify token
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

// GET USER STATS (Donations, Lives Touched, Points)
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Total Donations by this user
        const donationCount = await Donation.countDocuments({ donorId: userId });

        // 2. Lives Touched (Donations that were accepted/progress/completed)
        const impactCount = await Donation.countDocuments({
            donorId: userId,
            status: { $in: ['in-progress', 'completed'] }
        });

        // 3. Points (Mock calculation: 10 per donation, 50 per impact)
        const points = (donationCount * 10) + (impactCount * 50);

        res.json({
            donations: donationCount,
            livesTouched: impactCount,
            points: points
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET USER PROFILE
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// UPDATE USER PROFILE (Image)
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { image, name, phone, address, home, street } = req.body;
        // Build update object
        const updateFields = {};
        if (name) updateFields.name = name;
        if (phone) updateFields.phone = phone;
        if (address) updateFields.address = address;
        if (home) updateFields.home = home;
        if (street) updateFields.street = street;

        if (image) {
            try {
                // Upload base64 image to Cloudinary
                const result = await cloudinary.uploader.upload(image, {
                    folder: 'profiles',
                    transformation: [{ width: 200, height: 200, crop: "fill" }] // Optimize for profile
                });
                updateFields.profileImage = result.secure_url;
            } catch (uploadError) {
                console.error('Cloudinary upload error:', uploadError);
                return res.status(500).json({ error: 'Image upload failed' });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({ success: true, user });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET LEADERBOARD
router.get('/leaderboard', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // One-time fix for existing points (like the user who has 200 pts but no badges)
        const currentUser = await User.findById(req.user.id);
        if (currentUser) {
            const newBadgesTriggered = await checkAndAwardBadges(currentUser);
            if (newBadgesTriggered) {
                const io = req.app.get('io');
                if (io) {
                    io.to(currentUser._id.toString()).emit('user:badges_updated', {
                        pendingBadges: currentUser.pendingBadges,
                        badges: currentUser.badges
                    });
                }
            }
        }

        const topDonors = await User.find({})
            .select('name profileImage points level badges pendingBadges')
            .sort({ points: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments({});

        res.json({
            users: topDonors,
            total,
            page: parseInt(page),
            hasMore: total > skip + topDonors.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET PUBLIC PROFILE (with donations and badges)
router.get('/profile/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId).select('name profileImage points level badges pendingBadges createdAt');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch user's public donations
        const donations = await Donation.find({ donorId: userId, status: 'pending' })
            .sort({ createdAt: -1 })
            .limit(10);

        // Fetch stats
        const donationCount = await Donation.countDocuments({ donorId: userId });
        const impactCount = await Donation.countDocuments({
            donorId: userId,
            status: { $in: ['in-progress', 'completed'] }
        });

        res.json({
            user,
            donations,
            stats: {
                totalDonations: donationCount,
                impact: impactCount
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// CLAIM A BADGE
router.post('/badges/claim', authMiddleware, async (req, res) => {
    try {
        const { badgeName } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ error: 'User not found' });

        const badgeIndex = user.pendingBadges.findIndex(b => b.name === badgeName);
        if (badgeIndex === -1) {
            return res.status(400).json({ error: 'Badge not found in pending list' });
        }

        const claimedBadge = user.pendingBadges[badgeIndex];

        // Move to earned badges
        user.badges.push({
            name: claimedBadge.name,
            icon: claimedBadge.icon,
            category: claimedBadge.category,
            earnedAt: new Date()
        });

        // Remove from pending
        user.pendingBadges.splice(badgeIndex, 1);

        // Update level
        user.level = user.badges.length + 1;

        await user.save();

        const io = req.app.get('io');
        if (io) {
            io.to(user._id.toString()).emit('user:badges_updated', {
                badges: user.badges,
                pendingBadges: user.pendingBadges,
                level: user.level
            });
        }

        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET ALL POSSIBLE BADGES (Catalog)
router.get('/badges', authMiddleware, async (req, res) => {
    try {
        const { BADGE_LEVELS } = require('../utils/badgeHelper');
        res.json(BADGE_LEVELS);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
