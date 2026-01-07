const express = require('express');
const router = express.Router();
const DonationRequest = require('../models/DonationRequest');
const Donation = require('../models/Donation');
const Notification = require('../models/Notification');
const User = require('../models/User');
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

// CREATE DONATION REQUEST
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const { donationId, message } = req.body;

        if (!donationId) {
            return res.status(400).json({ error: 'Donation ID is required' });
        }

        // Get donation details
        const donation = await Donation.findById(donationId).populate('donorId', 'name');
        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        // Check if user already requested this donation
        const existingRequest = await DonationRequest.findOne({
            donationId,
            requesterId: req.user.id
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'You have already requested this donation' });
        }

        // Create request
        const newRequest = new DonationRequest({
            donationId,
            requesterId: req.user.id,
            donorId: donation.donorId._id,
            message: message || ''
        });

        await newRequest.save();

        // Populate requester info
        await newRequest.populate('requesterId', 'name email phone');

        // Add requester to donation's requestedBy array
        await Donation.findByIdAndUpdate(donationId, {
            $addToSet: { requestedBy: req.user.id }
        });

        // Create notification for donor
        const notification = new Notification({
            userId: donation.donorId._id,
            type: 'donation_request',
            title: '🎁 New Donation Request',
            message: `${newRequest.requesterId.name} is interested in your ${donation.title} (${donation.category})`,
            data: {
                donationId: donation._id,
                requestId: newRequest._id,
                requesterId: req.user.id,
                requesterName: newRequest.requesterId.name
            }
        });

        await notification.save();

        // Emit socket event to donor
        const io = req.app.get('io');
        if (io) {
            // Send full populated request for "Action Needed" dashboard section
            io.to(donation.donorId._id.toString()).emit('request:new', newRequest);

            io.to(donation.donorId._id.toString()).emit('notification:new', {
                notification,
                unreadCount: await Notification.countDocuments({
                    userId: donation.donorId._id,
                    read: false
                })
            });
        }

        res.status(201).json({
            success: true,
            request: newRequest,
            message: 'Request sent successfully'
        });

    } catch (err) {
        console.error('Request creation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET MY REQUESTS (requests I made)
router.get('/my-requests', authMiddleware, async (req, res) => {
    try {
        const requests = await DonationRequest.find({ requesterId: req.user.id })
            .populate('donationId', 'title category imageUrl status')
            .populate('donorId', 'name email phone profileImage')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET RECEIVED REQUESTS (requests for my donations)
router.get('/received', authMiddleware, async (req, res) => {
    try {
        const requests = await DonationRequest.find({ donorId: req.user.id })
            .populate('donationId', 'title category imageUrl description')
            .populate('requesterId', 'name email phone profileImage')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET SINGLE REQUEST
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const request = await DonationRequest.findById(req.params.id)
            .populate('donationId', 'title category imageUrl description')
            .populate('requesterId', 'name email phone profileImage')
            .populate('donorId', 'name email phone profileImage');

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check if user is either donor or requester
        if (request.donorId._id.toString() !== req.user.id && request.requesterId._id.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(request);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ACCEPT REQUEST
router.put('/:id/accept', authMiddleware, async (req, res) => {
    try {
        const request = await DonationRequest.findById(req.params.id)
            .populate('requesterId', 'name email')
            .populate('donationId', 'title');

        console.log('Accepting Reqeust ID:', req.params.id);
        console.log('User ID from token:', req.user.id);
        console.log('Donor ID from request:', request?.donorId?.toString());

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.donorId.toString() !== req.user.id) {
            console.log('Auth check failed:', { donorId: request.donorId.toString(), userId: req.user.id });
            return res.status(403).json({ error: 'Not authorized: You are not the donor of this item' });
        }

        // Update request status
        request.status = 'accepted';
        await request.save();

        const donationId = request.donationId._id || request.donationId;

        // Update donation
        await Donation.findByIdAndUpdate(donationId, {
            acceptedRequestId: request._id,
            receiverId: request.requesterId._id || request.requesterId,
            status: 'in-progress'
        });

        // Reject other pending requests for this donation
        await DonationRequest.updateMany(
            {
                donationId: request.donationId._id,
                _id: { $ne: request._id },
                status: 'pending'
            },
            { status: 'rejected' }
        );

        // AWARD POINTS TO DONOR
        const donorUser = await User.findById(req.user.id);
        if (donorUser) {
            donorUser.points = (donorUser.points || 0) + 100;
            const { checkAndAwardBadges } = require('../utils/badgeHelper');
            const badgesEarned = await checkAndAwardBadges(donorUser);

            const io = req.app.get('io');
            if (io && badgesEarned) {
                io.to(donorUser._id.toString()).emit('user:level_up', {
                    points: donorUser.points,
                    level: donorUser.level,
                    badges: donorUser.badges
                });
            }
        }

        // Create notification for requester
        const notification = new Notification({
            userId: request.requesterId._id || request.requesterId,
            type: 'donation_accepted',
            title: '✅ Request Accepted!',
            message: `Good news! Your request for ${request.donationId.title} has been accepted by the donor. Click to view contact details.`,
            data: {
                donationId: donationId,
                requestId: request._id
            }
        });

        await notification.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            // Notify donor to update their dashboard
            io.to(request.donorId.toString()).emit('request:updated', request);

            io.to(request.requesterId._id.toString()).emit('notification:new', {
                notification,
                unreadCount: await Notification.countDocuments({
                    userId: request.requesterId._id,
                    read: false
                })
            });

            // Emit donation update to all users (for Find screen)
            const updatedDonation = await Donation.findById(donationId).populate('donorId', 'name profileImage');
            io.emit('donation:updated', updatedDonation);
        }

        res.json({ success: true, request });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// REJECT REQUEST
router.put('/:id/reject', authMiddleware, async (req, res) => {
    try {
        const { reason } = req.body;
        const request = await DonationRequest.findById(req.params.id)
            .populate('requesterId', 'name')
            .populate('donationId', 'title');

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.donorId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized: You are not the donor of this item' });
        }

        request.status = 'rejected';
        await request.save();

        const donationId = request.donationId._id || request.donationId;

        // Create notification for requester
        const notification = new Notification({
            userId: request.requesterId._id || request.requesterId,
            type: 'donation_rejected',
            title: '❌ Request Declined',
            message: `Your request for ${request.donationId.title} was declined.${reason ? ` Reason: ${reason}` : ''}`,
            data: {
                donationId: donationId,
                requestId: request._id,
                reason: reason
            }
        });

        await notification.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            // Notify donor to update their dashboard
            io.to(request.donorId.toString()).emit('request:updated', request);

            io.to(request.requesterId._id.toString()).emit('notification:new', {
                notification,
                unreadCount: await Notification.countDocuments({
                    userId: request.requesterId._id,
                    read: false
                })
            });

            // Emit donation update to all users (for Find screen)
            const updatedDonation = await Donation.findById(donationId).populate('donorId', 'name profileImage');
            io.emit('donation:updated', updatedDonation);
        }

        res.json({ success: true, request });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// SEND THANKS (In-app notification)
router.post('/:id/thanks', authMiddleware, async (req, res) => {
    try {
        const request = await DonationRequest.findById(req.params.id)
            .populate('requesterId', 'name')
            .populate('donorId', 'name')
            .populate('donationId', 'title');

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (!request.requesterId || !request.donorId || !request.donationId) {
            return res.status(400).json({ error: 'Incomplete request data. Cannot send thanks.' });
        }

        // Only the requester can say thanks
        if (request.requesterId._id.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const requesterName = request.requesterId.name || 'A user';
        const donorName = request.donorId.name || 'the donor';
        const itemTitle = request.donationId.title || 'the donated item';

        const messages = [
            `❤️ Huge thanks to ${donorName} for the ${itemTitle}! You're a hero!`,
            `🌟 ${requesterName} says: Thank you so much for your generosity with ${itemTitle}.`,
            `🙏 God bless you ${donorName} for donating ${itemTitle}. It means a lot!`,
            `🙌 ${itemTitle} received! Thank you for being such a kind soul, ${donorName}.`,
            `✨ Sending love and thanks to ${donorName} for the amazing ${itemTitle}.`
        ];

        const randomMessage = messages[Math.floor(Math.random() * messages.length)];

        const notification = new Notification({
            userId: request.donorId._id,
            type: 'say_thanks',
            title: '❤️ Someone Said Thanks!',
            message: randomMessage,
            data: {
                donationId: request.donationId._id,
                requestId: request._id,
                senderName: request.requesterId.name
            }
        });

        await notification.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(request.donorId._id.toString()).emit('notification:new', {
                notification,
                unreadCount: await Notification.countDocuments({
                    userId: request.donorId._id,
                    read: false
                })
            });
        }

        request.thanksSent = true;
        await request.save();

        res.json({ success: true, message: 'Thanks sent!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
