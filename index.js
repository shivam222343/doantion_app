require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '50mb' })); // Increased for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/donation_app';
mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB Connected to:', mongoURI.split('@')[1] || 'localhost'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Socket.IO Setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Make io accessible in routes
app.set('io', io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/users', require('./routes/users'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/notifications', require('./routes/notifications'));

// Socket Middleware for Authentication
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: No token provided"));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error("Authentication error: Invalid token"));
    }
});

// Socket Connection Handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user?.id} (${socket.id})`);

    if (socket.user?.id) {
        socket.join(socket.user.id);
    }

    socket.on('chat:join', (chatId) => {
        socket.join(chatId);
        console.log(`User ${socket.user.id} joined chat ${chatId}`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });

    socket.on('user:location:update', async (coords) => {
        try {
            const User = require('./models/User');
            await User.findByIdAndUpdate(socket.user.id, {
                location: {
                    type: 'Point',
                    coordinates: [coords.longitude, coords.latitude],
                    lastUpdated: Date.now()
                }
            });

            socket.broadcast.emit('user:moved', {
                userId: socket.user.id,
                location: coords
            });

        } catch (err) {
            console.error('Location update error:', err);
        }
    });
});

app.get('/', (req, res) => {
    res.send('Donation App Backend is Running');
});

// Global Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
