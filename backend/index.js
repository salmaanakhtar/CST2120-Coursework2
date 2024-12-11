const express = require('express');
const mongodb = require('mongodb');
const bcrypt = require('bcrypt');
const path = require('path'); 
const User = require('./models/userModel');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const port = 8080;
const msis = 'M00915500';
const mongoUrl = 'mongodb+srv://akhtarsalmaan0:akhtarsalmaan0@serverlessinstance0.azj3zqe.mongodb.net/?retryWrites=true&w=majority&appName=ServerlessInstance0';

async function createIndexes() {
    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        
        await db.collection('users').createIndex({
            username: "text",
            email: "text"
        });
        
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

let loggedInUsers = {};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});;

app.post(`/${msis}/users`, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        
        const existingUser = await db.collection('users').findOne({ username });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const lastUser = await db.collection('users').find().sort({ userId: -1 }).limit(1).toArray();
        const userId = lastUser.length > 0 ? lastUser[0].userId + 1 : 1;

        const user = {
            userId,
            username,
            email,
            password: hashedPassword,
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

app.post(`/${msis}/login`, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        const user = await db.collection('users').findOne({ username });

        if (user && await bcrypt.compare(password, user.password)) {
            loggedInUsers[user.userId] = true;
            res.json({ success: true, message: 'Logged in successfully', userId: user.userId });
        } else {
            res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.get(`/${msis}/login`, (req, res) => {
    const { userId } = req.query;
    res.json({ 
        success: true, 
        loggedIn: !!loggedInUsers[userId] 
    });
});

app.delete(`/${msis}/login`, (req, res) => {
    const { userId } = req.body;

    if (loggedInUsers[userId]) {
        delete loggedInUsers[userId];
        res.json({ success: true, message: 'Logged out successfully' });
    } else {
        res.status(400).json({ success: false, error: 'User not logged in' });
    }
});

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
            imageIds: [],
            likes: [],
            comments: []
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

const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
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

          
            const uploadPromise = new Promise((resolve, reject) => {
                uploadStream.on('finish', () => resolve(uploadStream.id));
                uploadStream.on('error', reject);
            });

           
            uploadStream.write(req.file.buffer);
            uploadStream.end();

           
            const imageId = await uploadPromise;

            
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


app.get(`/${msis}/images/:imageId`, async (req, res) => {
    const { imageId } = req.params;

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const bucket = new mongodb.GridFSBucket(db, {
            bucketName: 'images'
        });

       
        const file = await db.collection('images.files').findOne({ 
            _id: new ObjectId(imageId) 
        });
        
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }

        res.set({
            'Content-Type': file.contentType,
            'Content-Length': file.length,
            'Content-Disposition': `inline; filename="${file.metadata.filename}"`,
            'Cache-Control': 'public, max-age=31557600' 
        });

        
        const downloadStream = bucket.openDownloadStream(new ObjectId(imageId));
        downloadStream.on('error', (error) => {
            res.status(500).json({ success: false, error: error.message });
        });

        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
    
});


app.get(`/${msis}/images/:imageId/download`, async (req, res) => {
    const { imageId } = req.params;
    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    
    try {
        await client.connect();
        const db = client.db('CW2');
        const bucket = new mongodb.GridFSBucket(db, { bucketName: 'images' });
        
        const file = await db.collection('images.files').findOne({ 
            _id: new ObjectId(imageId) 
        });
        
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }

        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file.metadata.filename}"`,
            'Content-Length': file.length
        });

        const downloadStream = bucket.openDownloadStream(new ObjectId(imageId));
        downloadStream.pipe(res);
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

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
        

        if (viewUserId) {
            query.userId = parseInt(viewUserId);
        } else {

            query.userId = {
                $in: [...user.following, parseInt(userId)]
            };
        }

        const contents = await db.collection('contents')
            .find(query)
            .sort({ dateCreated: -1 })
            .toArray();

        for (let content of contents) {
            if (content.imageIds && content.imageIds.length) {
                content.images = content.imageIds.map(id => ({
                    url: `/${msis}/images/${id.toString()}`,
                    id: id.toString()
                }));
            }
            if (content.fileIds) {
                const files = await db.collection('files.files')
                    .find({ 
                        _id: { $in: content.fileIds.map(id => new ObjectId(id)) }
                    })
                    .toArray();
                    
                content.files = files.map(file => ({
                    url: `/${msis}/files/${file._id}`,
                    id: file._id.toString(),
                    filename: file.filename,
                    contentType: file.contentType
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

        for (let content of contents) {
            if (content.imageIds && content.imageIds.length) {
                content.images = content.imageIds.map(id => ({
                    url: `/${msis}/images/${id.toString()}`,
                    id: id.toString()
                }));
            }

            if (content.fileIds) {
                const files = await db.collection('files.files')
                    .find({ 
                        _id: { $in: content.fileIds.map(id => new ObjectId(id)) }
                    })
                    .toArray();
                    
                content.files = files.map(file => ({
                    url: `/${msis}/files/${file._id}`,
                    id: file._id.toString(),
                    filename: file.filename,
                    contentType: file.contentType
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

app.get(`/${msis}/contents/forYou`, async (req, res) => {
    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');
        const contents = await db.collection('contents').aggregate([{ $sample: { size: 10 } }]).toArray();

        for (let content of contents) {
            if (content.imageIds && content.imageIds.length) {
                content.images = content.imageIds.map(id => ({
                    url: `http://localhost:8080/${msis}/images/${id.toString()}`,
                    id: id.toString()
                }));
            }
            if (content.fileIds) {
                const files = await db.collection('files.files')
                    .find({ 
                        _id: { $in: content.fileIds.map(id => new ObjectId(id)) }
                    })
                    .toArray();
                    
                content.files = files.map(file => ({
                    url: `/${msis}/files/${file._id}`,
                    id: file._id.toString(),
                    filename: file.filename,
                    contentType: file.contentType
                }));
            }
        }

        res.json({ success: true, contents });
    } catch (error) {
        res.json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.post(`/${msis}/contents/:contentId/like`, async (req, res) => {
    const { contentId } = req.params;
    const { userId } = req.body;

    if (!userId || !loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to like posts'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const content = await db.collection('contents').findOne({ _id: new ObjectId(contentId) });
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }

        if (!content.likes.includes(parseInt(userId))) {
            await db.collection('contents').updateOne(
                { _id: new ObjectId(contentId) },
                { $push: { likes: parseInt(userId) } }
            );
        }

        res.json({
            success: true,
            message: 'Post liked successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.delete(`/${msis}/contents/:contentId/like`, async (req, res) => {
    const { contentId } = req.params;
    const { userId } = req.body;

    if (!userId || !loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to unlike posts'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const content = await db.collection('contents').findOne({ _id: new ObjectId(contentId) });
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }

        await db.collection('contents').updateOne(
            { _id: new ObjectId(contentId) },
            { $pull: { likes: parseInt(userId) } }
        );

        res.json({
            success: true,
            message: 'Post unliked successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.post(`/${msis}/contents/:contentId/comment`, async (req, res) => {
    const { contentId } = req.params;
    const { userId, comment } = req.body;

    if (!userId || !loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to comment on posts'
        });
    }

    if (!comment) {
        return res.status(400).json({
            success: false,
            error: 'Comment is required'
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

        const content = await db.collection('contents').findOne({ _id: new ObjectId(contentId) });
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }

        const commentDoc = {
            userId: parseInt(userId),
            username: user.username,
            comment,
            dateCreated: new Date()
        };

        await db.collection('contents').updateOne(
            { _id: new ObjectId(contentId) },
            { $push: { comments: commentDoc } }
        );

        res.json({
            success: true,
            message: 'Comment added successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});

app.post(`/${msis}/follow/:userToFollowId?`, async (req, res) => {

    let userToFollowId = req.params.userToFollowId;
    const { userId } = req.body;
    

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

        const user = await db.collection('users').findOne({ userId: parseInt(userId) });
        const userToFollow = await db.collection('users').findOne({ userId: parseInt(userToFollowId) });

        if (!user || !userToFollow) {
            return res.status(404).json({
                success: false,
                error: 'One or both users not found'
            });
        }

        if (user.following.includes(parseInt(userToFollowId))) {
            return res.status(400).json({
                success: false,
                error: 'Already following this user'
            });
        }

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

app.delete(`/${msis}/follow/:userToUnfollowId?`, async (req, res) => {

    let userToUnfollowId = req.params.userToUnfollowId;
    const { userId } = req.body;
    
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

        const user = await db.collection('users').findOne({ userId: parseInt(userId) });
        const userToUnfollow = await db.collection('users').findOne({ userId: parseInt(userToUnfollowId) });

        if (!user || !userToUnfollow) {
            return res.status(404).json({
                success: false,
                error: 'One or both users not found'
            });
        }

        if (!user.following.includes(parseInt(userToUnfollowId))) {
            return res.status(400).json({
                success: false,
                error: 'Not currently following this user'
            });
        }

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

app.get(`/${msis}/users/:userId/following/posts`, async (req, res) => {
    const { userId } = req.params;

    if (!loggedInUsers[userId]) {
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to view posts'
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

        const followedUserIds = user.following || [];
        const query = {
            userId: {
                $in: [...followedUserIds, parseInt(userId)]
            }
        };

        const contents = await db.collection('contents')
            .find(query)
            .sort({ dateCreated: -1 })
            .toArray();

        for (let content of contents) {
            if (content.imageIds && content.imageIds.length) {
                content.images = content.imageIds.map(id => ({
                    url: `http://localhost:8080/${msis}/images/${id.toString()}`,
                    id: id.toString()
                }));
            }

            if (content.fileIds) {
                const files = await db.collection('files.files')
                    .find({ 
                        _id: { $in: content.fileIds.map(id => new ObjectId(id)) }
                    })
                    .toArray();
                    
                content.files = files.map(file => ({
                    url: `/${msis}/files/${file._id}`,
                    id: file._id.toString(),
                    filename: file.filename,
                    contentType: file.contentType
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

app.get(`/${msis}/users/search`, async (req, res) => {
    const { q: searchQuery, userId } = req.query;

    console.log(`Received search request with query: ${searchQuery} and userId: ${userId}`);

    if (!searchQuery) {
        console.log('Search query is required');
        return res.status(400).json({
            success: false,
            error: 'Search query is required'
        });
    }

    if (!userId || !loggedInUsers[userId]) {
        console.log('User must be logged in to search');
        return res.status(401).json({
            success: false,
            error: 'User must be logged in to search'
        });
    }

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        console.log('Connected to database');


        const users = await db.collection('users')
            .find({ username: { $regex: searchQuery, $options: 'i' } })
            .toArray();

        console.log(`Found users: ${JSON.stringify(users)}`);

        const currentUser = await db.collection('users').findOne({ userId: parseInt(userId) });

        if (!currentUser) {
            console.log('Current user not found');
            return res.status(404).json({
                success: false,
                error: 'Current user not found'
            });
        }

        console.log(`Current user: ${JSON.stringify(currentUser)}`);

        const usersWithFollowStatus = users.map(user => ({
            userId: user.userId,
            username: user.username,
            isFollowing: currentUser.following.includes(user.userId)
        }));

        console.log(`Users with follow status: ${JSON.stringify(usersWithFollowStatus)}`);

        res.json({
            success: true,
            query: searchQuery,
            results: usersWithFollowStatus
        });
    } catch (error) {
        console.log(`Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
        console.log('Database connection closed');
    }
});

app.get(`/${msis}/users/:userId`, async (req, res) => {
    const { userId } = req.params;

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

        res.json({
            success: true,
            user: {
                userId: user.userId,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.close();
    }
});


app.get(`/${msis}/contents/search`, async (req, res) => {
    const { q: searchQuery } = req.query;
    const { userId } = req.query; 

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

        const currentUser = await db.collection('users').findOne({ userId: parseInt(userId) });

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

const uploadFile = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    }
}).single('file');


app.post(`/${msis}/contents/:contentId/files`, (req, res) => {
    uploadFile(req, res, async (err) => {
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
                error: 'User must be logged in to upload files'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'File is required'
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
                    error: 'Not authorized to add files to this content'
                });
            }

            const bucket = new mongodb.GridFSBucket(db, {
                bucketName: 'files'
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

            const uploadPromise = new Promise((resolve, reject) => {
                uploadStream.on('finish', () => resolve(uploadStream.id));
                uploadStream.on('error', reject);
            });

            uploadStream.write(req.file.buffer);
            uploadStream.end();

            const fileId = await uploadPromise;

            await db.collection('contents').updateOne(
                { _id: new ObjectId(contentId) },
                { $push: { fileIds: fileId } }
            );

            res.json({
                success: true,
                fileId: fileId.toString(),
                message: 'File uploaded successfully'
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        } finally {
            await client.close();
        }
    });
});

app.get(`/${msis}/files/:fileId`, async (req, res) => {
    const { fileId } = req.params;

    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db('CW2');

        const bucket = new mongodb.GridFSBucket(db, {
            bucketName: 'files'
        });

        const file = await db.collection('files.files').findOne({ 
            _id: new ObjectId(fileId) 
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        res.set({
            'Content-Type': file.contentType,
            'Content-Length': file.length,
            'Content-Disposition': `inline; filename="${file.metadata.filename}"`,
            'Cache-Control': 'public, max-age=31557600'
        });

        const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
        downloadStream.on('error', (error) => {
            res.status(500).json({ success: false, error: error.message });
        });

        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get(`/${msis}/files/:fileId/download`, async (req, res) => {
    const { fileId } = req.params;
    const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
    
    try {
        await client.connect();
        const db = client.db('CW2');
        const bucket = new mongodb.GridFSBucket(db, { bucketName: 'files' });
        
        const file = await db.collection('files.files').findOne({ 
            _id: new ObjectId(fileId) 
        });
        
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${file.metadata.filename}"`,
            'Content-Length': file.length
        });

        const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
        downloadStream.pipe(res);
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get(`/${msis}/backup`, async (req, res) => {

    try {
        const client = new mongodb.MongoClient(mongoUrl, { useUnifiedTopology: true });
        await client.connect();
        const db = client.db('CW2');


        const backupDir = path.join(__dirname, 'backups');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup-${timestamp}`);
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        fs.mkdirSync(backupPath);

        const collections = await db.listCollections().toArray();

  
        for (const collection of collections) {
            const data = await db.collection(collection.name).find({}).toArray();
            fs.writeFileSync(
                path.join(backupPath, `${collection.name}.json`),
                JSON.stringify(data, null, 2)
            );
        }

     
        const zipPath = `${backupPath}.zip`;
        await execPromise(`powershell Compress-Archive -Path "${backupPath}/*" -DestinationPath "${zipPath}"`);

     
        res.download(zipPath, `backup-${timestamp}.zip`, (err) => {
            if (err) {
                console.error('Error sending backup:', err);
            }
       
            fs.rmSync(backupPath, { recursive: true, force: true });
            fs.rmSync(zipPath, { force: true });
        });

        await client.close();

    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create backup'
        });
    }
});

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

