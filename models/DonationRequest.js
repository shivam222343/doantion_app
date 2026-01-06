const mongoose = require('mongoose');

const donationRequestSchema = new mongoose.Schema({
    donationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donation',
        required: true
    },
    requesterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    donorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    message: {
        type: String,
        trim: true,
        default: ''
    },
    thanksSent: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
donationRequestSchema.index({ donationId: 1, requesterId: 1 });
donationRequestSchema.index({ donorId: 1, status: 1 });

module.exports = mongoose.model('DonationRequest', donationRequestSchema);
