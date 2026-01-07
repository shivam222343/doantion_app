const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        trim: true
    },
    profileCompleted: {
        type: Boolean,
        default: false
    },
    profileImage: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        trim: true
    },
    home: {
        type: String,
        trim: true
    },
    street: {
        type: String,
        trim: true
    },
    // Geospatial Point: [Longitude, Latitude]
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0] // [longitude, latitude]
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    socketId: {
        type: String
    },
    points: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    badges: [{
        name: String,
        icon: String,
        earnedAt: {
            type: Date,
            default: Date.now
        },
        category: String // e.g., 'Milestone', 'Category Expert', etc.
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create 2dsphere index for geospatial queries
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
