const express = require('express');
const mongodb = require('mongodb');
const User = require('./models/userModel');

const app = express();
const port = 8080;
const msis = 'M00915500';
const mongoUrl = 'mongodb://localhost:27017';

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

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

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Available endpoints:`);
    console.log(`GET / - Hello World`);
    console.log(`POST /${msis}/users - Sign up a new user with username, email, and password`);
});