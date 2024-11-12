class Content {
    constructor(contentId, userId, text, timestamp, fileIds = {}) {
        this.contentId = contentId;
        this.userId = userId;
        this.text = text;
        this.timestamp = timestamp;
        // Store references to uploaded files
        this.fileIds = fileIds; // { videos: [], images: [], files: [] }
    }
}

module.exports = Content;