const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Donation = require('../models/Donation');
const DonationRequest = require('../models/DonationRequest');
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

module.exports = router;
