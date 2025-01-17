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

// log to check connection string
console.log("Connection String: ", mongoURI);
// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

// Define a schema and model for users
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String
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

// Endpoint to handle user registration (for testing purposes)
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
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

// Add this endpoint to fetch users
app.get("/users", isAuthenticated, async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Add this endpoint to fetch click events
app.get("/clicks", isAuthenticated, async (req, res) => {
    try {
        const clicks = await Click.find({});
        res.json(clicks);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
