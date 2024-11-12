const express = require('express');
const mongodb = require('mongodb');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const Stream = require('stream');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 8080;
const msis = 'M00915500';
const mongoUrl = 'mongodb+srv://akhtarsalmaan0:akhtarsalmaan0@serverlessinstance0.azj3zqe.mongodb.net/?retryWrites=true&w=majority&appName=ServerlessInstance0';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 6 // Max 6 files
    }
}).fields([
    { name: 'images', maxCount: 3 },
    { name: 'videos', maxCount: 1 },
    { name: 'files', maxCount: 2 }
]);

// Middleware setup
app.use(express.json({ limit: '16mb' }));
app.use(express.raw({ type: '*/*', limit: '16mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Session management
let loggedInUsers = {};

// GridFS Bucket setup
async function getGridFSBucket(client) {
    const db = client.db('CW2');
    return new GridFSBucket(db);
}

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

// Content Management with improved file upload handling
app.post(`/${msis}/contents`, (req, res) => {
    upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                error: `File upload error: ${err.message}`
            });
        } else if (err) {
            return res.status(500).json({
                success: false,
                error: 'An unknown error occurred during file upload'
            });
        }

        console.log('Files received:', req.files);
        console.log('Body received:', req.body);

        const { userId, text } = req.body;
        if (!userId || !text) {
            return res.status(400).json({
                success: false,
                error: 'userId and text are required'
            });
        }

        const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
        try {
            await client.connect();
            const db = client.db('CW2');
            const bucket = await getGridFSBucket(client);

            const fileIds = {
                videos: [],
                images: [],
                files: []
            };

            // Process uploaded files
            if (req.files) {
                for (const category in req.files) {
                    const files = req.files[category];
                    for (const file of files) {
                        try {
                            const uploadStream = bucket.openUploadStream(file.originalname, {
                                metadata: {
                                    mimetype: file.mimetype,
                                    userId: userId,
                                    category: category
                                }
                            });

                            await new Promise((resolve, reject) => {
                                const bufferStream = new Stream.PassThrough();
                                bufferStream.end(file.buffer);
                                
                                bufferStream.pipe(uploadStream)
                                    .on('finish', () => {
                                        fileIds[category].push(uploadStream.id);
                                        resolve();
                                    })
                                    .on('error', (error) => {
                                        console.error('File upload error:', error);
                                        reject(error);
                                    });
                            });
                        } catch (uploadError) {
                            console.error('Error uploading file:', uploadError);
                            throw new Error(`Failed to upload file ${file.originalname}`);
                        }
                    }
                }
            }

            // Create content document
            const lastContent = await db.collection('contents')
                .find()
                .sort({ contentId: -1 })
                .limit(1)
                .toArray();
            const contentId = lastContent.length > 0 ? lastContent[0].contentId + 1 : 1;

            const content = {
                contentId,
                userId: parseInt(userId),
                text,
                timestamp: new Date(),
                fileIds
            };

            await db.collection('contents').insertOne(content);
            
            res.json({
                success: true,
                contentId: content.contentId,
                message: 'Content posted successfully',
                fileIds: fileIds
            });

        } catch (error) {
            console.error('Content creation error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            await client.close();
        }
    });
});

app.get(`/${msis}/contents`, async (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ 
            success: false, 
            error: 'userId is required' 
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        
        const user = await db.collection('users').findOne({ 
            userId: parseInt(userId) 
        });
        const following = user?.following || [];

        const contents = await db.collection('contents')
            .find({ userId: { $in: following } })
            .sort({ timestamp: -1 })
            .toArray();

        res.json({ 
            success: true, 
            contents,
            message: 'Contents retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    } finally {
        await client.close();
    }
});

// File retrieval endpoint
app.get(`/${msis}/files/:fileId`, async (req, res) => {
    const fileId = new mongodb.ObjectId(req.params.fileId);
    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    
    try {
        await client.connect();
        const bucket = await getGridFSBucket(client);
        const db = client.db('CW2');
        
        const file = await db.collection('fs.files').findOne({ _id: fileId });
        if (!file) {
            return res.status(404).json({ 
                success: false, 
                error: 'File not found' 
            });
        }

        if (file.metadata?.mimetype) {
            res.set('Content-Type', file.metadata.mimetype);
        }

        bucket.openDownloadStream(fileId).pipe(res);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
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
    console.log(`POST /${msis}/contents - Create new content`);
    console.log(`GET /${msis}/contents - Get following users' contents`);
    console.log(`GET /${msis}/files/:fileId - Get file by ID`);
});