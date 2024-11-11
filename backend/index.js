const express = require('express');
const mongodb = require('mongodb');
const User = require('./models/userModel');

const app = express();
const port = 8080;
const msis = 'M00915500';
const mongoUrl = 'mongodb+srv://akhtarsalmaan0:akhtarsalmaan0@serverlessinstance0.azj3zqe.mongodb.net/?retryWrites=true&w=majority&appName=ServerlessInstance0';

app.use(express.json());

let loggedInUsers = {};

// GET: Home route
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// POST: User Registration
app.post(`/${msis}/users`, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        
        const lastUser = await db.collection('users').find().sort({ userId: -1 }).limit(1).toArray();
        const userId = lastUser.length > 0 ? lastUser[0].userId + 1 : 1;

        const user = new User(userId, username, email, password);
        const result = await db.collection('users').insertOne(user);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// GET: Check login status
app.get(`/${msis}/login`, (req, res) => {
    const { username } = req.query;
    if (loggedInUsers[username]) {
        res.json({ success: true, loggedIn: true });
    } else {
        res.json({ success: true, loggedIn: false });
    }
});

// POST: User Login
app.post(`/${msis}/login`, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        const user = await db.collection('users').findOne({ username, password });

        if (user) {
            loggedInUsers[username] = true;
            res.json({ success: true, message: 'Logged in successfully' });
        } else {
            res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// DELETE: User Logout
app.delete(`/${msis}/login`, (req, res) => {
    const { username } = req.body;

    if (loggedInUsers[username]) {
        delete loggedInUsers[username];
        res.json({ success: true, message: 'Logged out successfully' });
    } else {
        res.status(400).json({ success: false, error: 'User not logged in' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Available endpoints:`);
    console.log(`GET / - Hello World`);
    console.log(`POST /${msis}/users - Sign up a new user with username, email, and password`);
    console.log(`GET /${msis}/login - Check login status`);
    console.log(`POST /${msis}/login - Log in a user`);
    console.log(`DELETE /${msis}/login - Log out a user`);
});