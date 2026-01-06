const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Added axios for geocoding proxy

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

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// UPLOAD IMAGE
router.post('/upload', authMiddleware, async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'Image is required' });
        }

        const uploadResponse = await cloudinary.uploader.upload(image, {
            folder: 'donations'
        });

        res.json({ imageUrl: uploadResponse.secure_url });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// CREATE DONATION
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const { title, description, category, quantity, location, image, address, home, street } = req.body;

        if (!title || !location || !location.latitude || !location.longitude || !address) {
            return res.status(400).json({ error: 'Title, location, and address are required' });
        }

        let imageUrl = null;
        if (image) {
            if (image.startsWith('http')) {
                // Already a Cloudinary URL from the instant upload
                imageUrl = image;
            } else {
                try {
                    // Upload base64 image to Cloudinary (fallback)
                    const result = await cloudinary.uploader.upload(image, {
                        folder: 'donations',
                    });
                    imageUrl = result.secure_url;
                } catch (uploadError) {
                    console.error('Cloudinary upload error:', uploadError);
                }
            }
        }

        const newDonation = new Donation({
            donorId: req.user.id,
            title,
            description,
            category: category || 'Others',
            quantity,
            imageUrl, // Save Cloudinary URL
            pickupLocation: {
                type: 'Point',
                coordinates: [location.longitude, location.latitude]
            },
            pickupAddress: address,
            home, // Added home
            street, // Added street
            status: 'pending'
        });

        await newDonation.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('donation:new', {
                donation: newDonation,
                donorLocation: { latitude: location.latitude, longitude: location.longitude }
            });
        }

        res.status(201).json({ success: true, donation: newDonation });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET NEARBY DONATIONS
router.get('/nearby', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude, radius = 5000 } = req.query; // Radius in meters (default 5km)

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and Longitude required' });
        }

        const donations = await Donation.find({
            status: 'pending',
            donorId: { $ne: req.user.id },
            pickupLocation: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseInt(radius)
                }
            }
        }).populate('donorId', 'name phone');

        res.json(donations);

    } catch (err) {
        console.error("Nearby Error", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET MY DONATIONS
router.get('/my-donations', authMiddleware, async (req, res) => {
    try {
        const { category } = req.query;
        let query = { donorId: req.user.id };

        if (category && category !== 'All') {
            query.category = category;
        }

        const donations = await Donation.find(query).sort({ createdAt: -1 });
        res.json(donations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET SINGLE DONATION
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id)
            .populate('donorId', 'name email phone profileImage address home street');

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        res.json(donation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// UPDATE DONATION
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, description, category, quantity, pickupAddress } = req.body;
        const donation = await Donation.findById(req.params.id);

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        if (donation.donorId.toString() !== req.user.id) {
            return res.status(401).json({ error: 'User not authorized' });
        }

        donation.title = title || donation.title;
        donation.description = description || donation.description;
        donation.category = category || donation.category;
        donation.quantity = quantity || donation.quantity;
        donation.pickupAddress = pickupAddress || donation.pickupAddress;

        await donation.save();
        res.json(donation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE DONATION
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id);

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        if (donation.donorId.toString() !== req.user.id) {
            return res.status(401).json({ error: 'User not authorized' });
        }

        // Optional: Also delete image from Cloudinary if needed
        // if (donation.imageUrl) {
        //     const publicId = donation.imageUrl.split('/').pop().split('.')[0];
        //     await cloudinary.uploader.destroy(`donations/${publicId}`);
        // }

        await donation.deleteOne();

        const io = req.app.get('io');
        if (io) {
            io.emit('donation:deleted', req.params.id);
        }

        res.json({ success: true, message: 'Donation deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GEOCODING PROXY (to avoid CORS)
router.get('/geocoding/reverse', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: 'Lat and Lon are required' });

        // Add zoom parameter for more accurate results (18 is street level)
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
            headers: {
                'User-Agent': 'DonationApp/1.0'
            }
        });

        console.log('Geocoding request:', { lat, lon });
        console.log('Geocoding response:', response.data.display_name);

        res.json(response.data);
    } catch (err) {
        console.error('Geocoding error:', err);
        res.status(500).json({ error: 'Geocoding failed' });
    }
});

module.exports = router;
