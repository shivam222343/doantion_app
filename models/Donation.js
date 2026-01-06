const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    donorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: 'Others',
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String
    },
    quantity: {
        type: String,
        default: '1'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    pickupLocation: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true // [longitude, latitude]
        }
    },
    requestedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    acceptedRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DonationRequest',
        default: null
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    pickupAddress: {
        type: String,
        required: true
    },
    home: {
        type: String,
        trim: true
    },
    street: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create 2dsphere index for finding nearby donations
donationSchema.index({ pickupLocation: '2dsphere' });

module.exports = mongoose.model('Donation', donationSchema);
