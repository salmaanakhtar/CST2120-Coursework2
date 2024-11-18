const express = require('express');
const mongodb = require('mongodb');
const { ObjectId } = require('mongodb');

const app = express();
const port = 8080;
const msis = 'M00915500';
const mongoUrl = 'mongodb+srv://akhtarsalmaan0:akhtarsalmaan0@serverlessinstance0.azj3zqe.mongodb.net/?retryWrites=true&w=majority&appName=ServerlessInstance0';

async function createIndexes() {
    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        
        // Create text index for users collection
        await db.collection('users').createIndex({
            username: "text",
            email: "text"
        });
        
        // Create text index for contents collection
        await db.collection('contents').createIndex({
            title: "text",
            content: "text"
        });
        
        console.log("Search indexes created successfully");
    } catch (error) {
        console.error("Error creating indexes:", error);
    } finally {
        await client.close();
    }
}

// Session management using userId
let loggedInUsers = {};  // Will store as { userId: { userId: number, username: string } }

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            loggedInUsers[user.userId] = {
                userId: user.userId,
                username: user.username
            };
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

// Check login status
app.get(`/${msis}/login`, (req, res) => {
    const { userId } = req.query;
    res.json({ 
        success: true, 
        loggedIn: !!loggedInUsers[userId] 
    });
});

// Logout
app.delete(`/${msis}/login`, (req, res) => {
    const { userId } = req.body;
    if (loggedInUsers[userId]) {
        delete loggedInUsers[userId];
        res.json({ success: true, message: 'Logged out successfully' });
    } else {
        res.status(400).json({ success: false, error: 'User not logged in' });
    }
});

// Post new content
app.post(`/${msis}/contents`, async (req, res) => {
    const { userId, title, content } = req.body;

    if (!userId || !title || !content) {
        return res.status(400).json({
            success: false,
            error: 'UserId, title and content are required'
        });
    }

    if (!loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to post content'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const user = await db.collection('users').findOne({ userId: parseInt(userId) });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const contentDoc = {
            userId: user.userId,
            username: user.username,
            title,
            content,
            dateCreated: new Date(),
            imageIds: []
        };

        const contentResult = await db.collection('contents').insertOne(contentDoc);
        
        res.json({
            success: true,
            contentId: contentResult.insertedId,
            message: 'Content posted successfully. Use /contents/:contentId/images to upload images.'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// Updated image upload endpoint using multer for handling multipart form data
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
}).single('image');

app.post(`/${msis}/contents/:contentId/images`, (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }

        const { contentId } = req.params;
        const { userId } = req.query;

        if (!userId || !loggedInUsers[userId]) {
            return res.status(401).json({
                success: false,
                error: 'User must be logged in to upload images'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Image file is required'
            });
        }

        const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
        try {
            await client.connect();
            const db = client.db('CW2');

            const content = await db.collection('contents').findOne({
                _id: new ObjectId(contentId)
            });

            if (!content) {
                return res.status(404).json({
                    success: false,
                    error: 'Content not found'
                });
            }

            if (content.userId !== parseInt(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized to add images to this content'
                });
            }

            const imageCount = await db.collection('images.files').countDocuments({
                'metadata.contentId': new ObjectId(contentId)
            });

            if (imageCount >= 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum of 3 images allowed per content'
                });
            }

            const bucket = new mongodb.GridFSBucket(db, {
                bucketName: 'images'
            });

            const uploadStream = bucket.openUploadStream(req.file.originalname, {
                contentType: req.file.mimetype,
                metadata: {
                    contentId: new ObjectId(contentId),
                    userId: parseInt(userId),
                    uploadDate: new Date(),
                    filename: req.file.originalname
                }
            });

            // Create a promise to handle the stream completion
            const uploadPromise = new Promise((resolve, reject) => {
                uploadStream.on('finish', () => resolve(uploadStream.id));
                uploadStream.on('error', reject);
            });

            // Write the buffer to the stream
            uploadStream.write(req.file.buffer);
            uploadStream.end();

            // Wait for the upload to complete
            const imageId = await uploadPromise;

            // Update the content document with the new image ID
            await db.collection('contents').updateOne(
                { _id: new ObjectId(contentId) },
                { $push: { imageIds: imageId } }
            );

            res.json({
                success: true,
                imageId: imageId.toString(),
                message: 'Image uploaded successfully'
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        } finally {
            await client.close();
        }
    });
});

// Updated image retrieval endpoint
app.get(`/${msis}/images/:imageId`, async (req, res) => {
    const { imageId } = req.params;

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const bucket = new mongodb.GridFSBucket(db, {
            bucketName: 'images'
        });

        // Get file metadata
        const file = await db.collection('images.files').findOne({ 
            _id: new ObjectId(imageId) 
        });
        
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }

        // Set response headers
        res.set({
            'Content-Type': file.contentType,
            'Content-Length': file.length,
            'Content-Disposition': `inline; filename="${file.metadata.filename}"`,
            'Cache-Control': 'public, max-age=31557600' // Cache for 1 year
        });

        // Stream the image data
        const downloadStream = bucket.openDownloadStream(new ObjectId(imageId));
        downloadStream.on('error', (error) => {
            res.status(500).json({ success: false, error: error.message });
        });

        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
    // Note: Don't close the client here as it would interrupt the stream
});

// Get contents with optional filtering
app.get(`/${msis}/contents`, async (req, res) => {
    const { userId, viewUserId } = req.query;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'UserId is required'
        });
    }

    if (!loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to view contents'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const user = await db.collection('users').findOne({ userId: parseInt(userId) });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        let query = {};
        
        // If viewUserId is provided, show only that user's posts
        if (viewUserId) {
            query.userId = parseInt(viewUserId);
        } else {
            // Otherwise, show posts from followed users and own posts
            query.userId = {
                $in: [...user.following, parseInt(userId)]
            };
        }

        const contents = await db.collection('contents')
            .find(query)
            .sort({ dateCreated: -1 })
            .toArray();

        // Enhance content with image URLs
        for (let content of contents) {
            if (content.imageIds && content.imageIds.length) {
                content.images = content.imageIds.map(id => ({
                    url: `/${msis}/images/${id.toString()}`,
                    id: id.toString()
                }));
            }
        }

        res.json({
            success: true,
            contents: contents
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// Add a helper endpoint to get all contents (for testing)
app.get(`/${msis}/contents/all`, async (req, res) => {
    const { userId } = req.query;

    if (!userId || !loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to view contents'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const contents = await db.collection('contents')
            .find({})
            .sort({ dateCreated: -1 })
            .toArray();

        // Enhance content with image URLs
        for (let content of contents) {
            if (content.imageIds && content.imageIds.length) {
                content.images = content.imageIds.map(id => ({
                    url: `/${msis}/images/${id.toString()}`,
                    id: id.toString()
                }));
            }
        }

        res.json({
            success: true,
            contents: contents
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// Follow a user (supports both JSON body and URL parameter)
app.post(`/${msis}/follow/:userToFollowId?`, async (req, res) => {
    // Get the user to follow from either URL parameter or JSON body
    let userToFollowId = req.params.userToFollowId;
    const { userId } = req.body;
    
    // If not in URL, check JSON body
    if (!userToFollowId && req.body.userToFollowId) {
        userToFollowId = req.body.userToFollowId;
    }

    if (!userId || !userToFollowId) {
        return res.status(400).json({
            success: false,
            error: 'Both userId and userToFollowId are required'
        });
    }

    if (!loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to follow others'
        });
    }

    if (parseInt(userId) === parseInt(userToFollowId)) {
        return res.status(400).json({
            success: false,
            error: 'Cannot follow yourself'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        // Check if both users exist
        const user = await db.collection('users').findOne({ userId: parseInt(userId) });
        const userToFollow = await db.collection('users').findOne({ userId: parseInt(userToFollowId) });

        if (!user || !userToFollow) {
            return res.status(404).json({
                success: false,
                error: 'One or both users not found'
            });
        }

        // Check if already following
        if (user.following.includes(parseInt(userToFollowId))) {
            return res.status(400).json({
                success: false,
                error: 'Already following this user'
            });
        }

        // Add to following list
        await db.collection('users').updateOne(
            { userId: parseInt(userId) },
            { $push: { following: parseInt(userToFollowId) } }
        );

        res.json({
            success: true,
            message: `Successfully followed user ${userToFollowId}`,
            details: {
                followerId: parseInt(userId),
                followingId: parseInt(userToFollowId),
                followerUsername: user.username,
                followingUsername: userToFollow.username
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// Unfollow a user (supports both JSON body and URL parameter)
app.delete(`/${msis}/follow/:userToUnfollowId?`, async (req, res) => {
    // Get the user to unfollow from either URL parameter or JSON body
    let userToUnfollowId = req.params.userToUnfollowId;
    const { userId } = req.body;
    
    // If not in URL, check JSON body
    if (!userToUnfollowId && req.body.userToUnfollowId) {
        userToUnfollowId = req.body.userToUnfollowId;
    }

    if (!userId || !userToUnfollowId) {
        return res.status(400).json({
            success: false,
            error: 'Both userId and userToUnfollowId are required'
        });
    }

    if (!loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to unfollow others'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        // Check if both users exist
        const user = await db.collection('users').findOne({ userId: parseInt(userId) });
        const userToUnfollow = await db.collection('users').findOne({ userId: parseInt(userToUnfollowId) });

        if (!user || !userToUnfollow) {
            return res.status(404).json({
                success: false,
                error: 'One or both users not found'
            });
        }

        // Check if actually following
        if (!user.following.includes(parseInt(userToUnfollowId))) {
            return res.status(400).json({
                success: false,
                error: 'Not currently following this user'
            });
        }

        // Remove from following list
        await db.collection('users').updateOne(
            { userId: parseInt(userId) },
            { $pull: { following: parseInt(userToUnfollowId) } }
        );

        res.json({
            success: true,
            message: `Successfully unfollowed user ${userToUnfollowId}`,
            details: {
                unfollowerId: parseInt(userId),
                unfollowedId: parseInt(userToUnfollowId),
                unfollowerUsername: user.username,
                unfollowedUsername: userToUnfollow.username
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.get(`/${msis}/users/search`, async (req, res) => {
    const { q: searchQuery } = req.query;
    const { userId } = req.query; // For authentication

    if (!searchQuery) {
        return res.status(400).json({
            success: false,
            error: 'Search query is required'
        });
    }

    if (!userId || !loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to search'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        // Perform text search
        const users = await db.collection('users')
            .find(
                {
                    $text: { $search: searchQuery }
                },
                {
                    projection: {
                        _id: 1,
                        userId: 1,
                        username: 1,
                        dateCreated: 1,
                        score: { $meta: "textScore" }
                    }
                }
            )
            .sort({ score: { $meta: "textScore" } })
            .toArray();

        // Get current user's following list
        const currentUser = await db.collection('users').findOne({ userId: parseInt(userId) });
        
        // Add isFollowing flag to results
        const usersWithFollowStatus = users.map(user => ({
            ...user,
            isFollowing: currentUser.following.includes(user.userId),
            // Remove sensitive information
            password: undefined,
            email: undefined
        }));

        res.json({
            success: true,
            query: searchQuery,
            results: usersWithFollowStatus
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// Search contents endpoint
app.get(`/${msis}/contents/search`, async (req, res) => {
    const { q: searchQuery } = req.query;
    const { userId } = req.query; // For authentication

    if (!searchQuery) {
        return res.status(400).json({
            success: false,
            error: 'Search query is required'
        });
    }

    if (!userId || !loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to search'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        // Perform text search on contents
        const contents = await db.collection('contents')
            .find(
                {
                    $text: { $search: searchQuery }
                },
                {
                    projection: {
                        score: { $meta: "textScore" }
                    }
                }
            )
            .sort({ score: { $meta: "textScore" } })
            .toArray();

        // Get current user's following list for reference
        const currentUser = await db.collection('users').findOne({ userId: parseInt(userId) });

        // Add additional context to each content item
        const enhancedContents = contents.map(content => ({
            ...content,
            isFromFollowedUser: currentUser.following.includes(content.userId),
            images: content.imageIds ? content.imageIds.map(id => ({
                url: `/${msis}/images/${id.toString()}`,
                id: id.toString()
            })) : []
        }));

        res.json({
            success: true,
            query: searchQuery,
            results: enhancedContents
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

// Start server
app.listen(port, () => {
    createIndexes();
    console.log(`Server is running at http://localhost:${port}`);
    console.log('\nAvailable endpoints:');
    console.log(`POST /${msis}/users - Register new user`);
    console.log(`POST /${msis}/login - User login`);
    console.log(`GET /${msis}/login - Check login status`);
    console.log(`DELETE /${msis}/login - User logout`);
    console.log(`POST /${msis}/contents - Create new content`);
    console.log(`POST /${msis}/contents/:contentId/images - Upload image to content`);
    console.log(`GET /${msis}/images/:imageId - Get image`);
    console.log(`GET /${msis}/contents - Get contents from followed users`);
});

