const express = require('express');
const mongodb = require('mongodb');

const app = express();
const port = 8080;
const msis = 'M00915500';
const mongoUrl = 'mongodb+srv://akhtarsalmaan0:akhtarsalmaan0@serverlessinstance0.azj3zqe.mongodb.net/?retryWrites=true&w=majority&appName=ServerlessInstance0';

// Session management
let loggedInUsers = {};

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// User Registration
app.post(`/${msis}/users`, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Username, email, and password are required' 
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        
        // Check if username already exists
        const existingUser = await db.collection('users').findOne({ username });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }

        const lastUser = await db.collection('users').find().sort({ userId: -1 }).limit(1).toArray();
        const userId = lastUser.length > 0 ? lastUser[0].userId + 1 : 1;

        const user = {
            userId,
            username,
            email,
            password,
            following: [],
            dateCreated: new Date()
        };

        const result = await db.collection('users').insertOne(user);
        res.json({ success: true, userId: user.userId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// Login Management
app.post(`/${msis}/login`, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Username and password are required' 
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        const user = await db.collection('users').findOne({ username, password });

        if (user) {
            loggedInUsers[username] = true;
            res.json({ 
                success: true, 
                userId: user.userId,
                message: 'Logged in successfully' 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                error: 'Invalid username or password' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.get(`/${msis}/login`, (req, res) => {
    const { username } = req.query;
    res.json({ 
        success: true, 
        loggedIn: !!loggedInUsers[username] 
    });
});

app.delete(`/${msis}/login`, (req, res) => {
    const { username } = req.body;
    if (loggedInUsers[username]) {
        delete loggedInUsers[username];
        res.json({ success: true, message: 'Logged out successfully' });
    } else {
        res.status(400).json({ success: false, error: 'User not logged in' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log('\nAvailable endpoints:');
    console.log(`POST /${msis}/users - Register new user`);
    console.log(`POST /${msis}/login - User login`);
    console.log(`GET /${msis}/login - Check login status`);
    console.log(`DELETE /${msis}/login - User logout`);
});