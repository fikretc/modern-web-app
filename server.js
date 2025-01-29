const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
require('dotenv').config();

const app = express();
const PORT = 8000;

// MongoDB connection string with environment variables
const dbUsername = process.env.MONGODB_USERNAME;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbName = process.env.MONGODB_DBNAME;
const dbHost = process.env.MONGODB_HOST;
const mongoURI = `mongodb://${dbUsername}:${dbPassword}@${dbHost}/${dbName}?authSource=admin`;

// Connect to MongoDB
mongoose.connect(mongoURI, { });

// Define a schema and model for users
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model("User", userSchema);

// Define a schema and model for click events
const clickSchema = new mongoose.Schema({
    lat: Number,
    lon: Number,
    username: String,
    timestamp: { type: Date, default: Date.now }
});
const Click = mongoose.model("Click", clickSchema);

// Middleware to parse form data and JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session management
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.status(401).send('Unauthorized');
    }
}

// Middleware to check if user is an admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) {
        return next();
    } else {
        res.status(403).send('Forbidden');
    }
}

// Handle form submissions
app.post("/submit", (req, res) => {
    const { name, email, message } = req.body;
    res.send(`Hello, ${name}. We received your message: "${message}". We will contact you at ${email}.`);
});

// Endpoint to handle user login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Endpoint to handle user registration (admin only)
app.post("/register", isAdmin, async (req, res) => {
    const { username, password, isAdmin } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, isAdmin });
    try {
        await newUser.save();
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Endpoint to save click events
app.post("/save-click", isAuthenticated, async (req, res) => {
    const { lat, lon } = req.body;
    const username = req.session.user.username;
    const newClick = new Click({ lat, lon, username });
    try {
        await newClick.save();
        res.status(200).send("Click event saved successfully.");
    } catch (error) {
        res.status(500).send("Error saving click event.");
    }
});

// Endpoint to fetch users (admin can see all, others can see only themselves)
app.get("/users", isAuthenticated, async (req, res) => {
    try {
        let users;
        if (req.session.user.isAdmin) {
            users = await User.find({});
        } else {
            users = await User.find({ username: req.session.user.username });
        }
        res.json(users);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Endpoint to fetch click events (admin can see all, others can see only their own)
app.get("/clicks", isAuthenticated, async (req, res) => {
    try {
        let clicks;
        if (req.session.user.isAdmin) {
            clicks = await Click.find({});
        } else {
            clicks = await Click.find({ username: req.session.user.username });
        }
        res.json(clicks);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Endpoint to fetch markers by user and time period (admin can see all, others can see only their own)
app.get("/report", isAuthenticated, async (req, res) => {
    const { username, start, end } = req.query;
    try {
        let markers;
        if (req.session.user.isAdmin || req.session.user.username === username) {
            markers = await Click.find({
                username,
                timestamp: {
                    $gte: new Date(start),
                    $lte: new Date(end)
                }
            });
        } else {
            res.status(403).send('Forbidden');
            return;
        }
        res.json(markers);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Serve the report.html page only to authenticated users
app.get("/report.html", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

// Endpoint to handle user logout
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Logout failed");
        }
        res.status(200).send("Logout successful");
    });
});

// Initialize admin user if it doesn't exist
async function initializeAdminUser() {
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
        const hashedPassword = await bcrypt.hash('adminpass', 10);
        const newAdmin = new User({ username: 'admin', password: hashedPassword, isAdmin: true });
        await newAdmin.save();
        console.log('Admin user created with username: admin and password: adminpass');
    }
}

initializeAdminUser();

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
