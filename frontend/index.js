document.addEventListener('DOMContentLoaded', function() {

    window.openModal = function() {
        document.getElementById('createPostModal').style.display = 'block';
    };

    window.closeModal = function() {
        document.getElementById('createPostModal').style.display = 'none';
    };

    window.handleSubmit = async function(event) {
        event.preventDefault();
        const userId = localStorage.getItem('userId');
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const images = document.getElementById('postImages').files;

        // Step 1: Create the post
        const createPostResponse = await fetch('/M00915500/contents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, title, content })
        });

        const createPostResult = await createPostResponse.json();
        if (!createPostResult.success) {
            alert(createPostResult.error);
            return;
        }

        const contentId = createPostResult.contentId;

        // Step 2: Upload images
        for (let i = 0; i < images.length; i++) {
            const formData = new FormData();
            formData.append('image', images[i]);

            const uploadImageResponse = await fetch(`/M00915500/contents/${contentId}/images?userId=${userId}`, {
                method: 'POST',
                body: formData
            });

            const uploadImageResult = await uploadImageResponse.json();
            if (!uploadImageResult.success) {
                alert(uploadImageResult.error);
                return;
            }
        }

        alert('Post created successfully!');
        closeModal();
        showHomePage(userId);
    };

    // Add click outside modal to close
    window.onclick = function(event) {
        const modal = document.getElementById('createPostModal');
        if (event.target === modal) {
            closeModal();
        }
    };
    function toggleForms() {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        loginForm.classList.toggle('hidden');
        signupForm.classList.toggle('hidden');
    }

    function openModal() {
        document.getElementById('createPostModal').style.display = 'block';
    }

    function closeModal() {
        document.getElementById('createPostModal').style.display = 'none';
    }

    function handleSubmit(event) {
        event.preventDefault();
        const userId = localStorage.getItem('userId');
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const images = document.getElementById('postImages').files;

        fetch('/M00915500/contents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, title, content })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('Post created successfully!');
                closeModal();
                window.location.reload();
            } else {
                alert(result.error);
            }
        })
        .catch(error => {
            alert('Error creating post');
        });
    }

    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target == document.getElementById('createPostModal')) {
            closeModal();
        }
    }

    function showHomePage(userId) {
        document.getElementById('forms').classList.add('hidden');
        document.getElementById('homePage').classList.remove('hidden');

        fetchAndDisplayPosts(userId);
        fetchFeaturedModels();

        // Fetch and display the user's name
        const userNameElement = document.getElementById('userName');
        const userNameXhr = new XMLHttpRequest();
        userNameXhr.open('GET', `/M00915500/users/${userId}`, true);
        userNameXhr.onreadystatechange = function() {
            if (userNameXhr.readyState === 4) {
                const userResult = JSON.parse(userNameXhr.responseText);
                if (userResult.success) {
                    userNameElement.textContent = `Welcome, ${userResult.user.username}`;
                } else {
                    alert(userResult.error);
                }
            }
        };
        userNameXhr.send();
    }

    function fetchAndDisplayPosts(userId) {
        // Fetch and display posts from followed users
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/M00915500/users/${userId}/following/posts`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    const postsContainer = document.getElementById('postsContainer');
                    postsContainer.innerHTML = '';
                    result.contents.forEach(post => {
                        const postElement = document.createElement('div');
                        postElement.className = 'post';
                        postElement.innerHTML = `
                            <h3>${post.title}</h3>
                            <p>${post.content}</p>
                            <small>Posted by ${post.username} on ${new Date(post.dateCreated).toLocaleString()}</small>
                            <button class="btn btn-primary" onclick="likePost('${post._id}')">Like</button>
                            <span>${post.likes.length} Likes</span>
                            <form onsubmit="addComment(event, '${post._id}')">
                                <input type="text" placeholder="Add a comment" required>
                                <button type="submit" class="btn btn-primary">Comment</button>
                            </form>
                            <div class="comments">
                                ${post.comments.map(comment => `
                                    <p><strong>${comment.userId}:</strong> ${comment.comment}</p>
                                `).join('')}
                            </div>
                        `;
                        if (post.images && post.images.length) {
                            post.images.forEach(image => {
                                const imgElement = document.createElement('img');
                                imgElement.src = image.url;
                                imgElement.alt = 'Post Image';
                                imgElement.style.maxWidth = '100%';
                                postElement.appendChild(imgElement);
                            });
                        }
                        postsContainer.appendChild(postElement);
                    });
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send();
    }

    async function fetchFeaturedModels() {
        const THINGIVERSE_API_KEY = 'cb6d85ba96eb4ab07fb636e613b4f7f7'; // Replace with your API key
        try {
            const response = await fetch('https://api.thingiverse.com/featured', {
                headers: {
                    'Authorization': `Bearer ${THINGIVERSE_API_KEY}`
                }
            });
            const models = await response.json();
            
            const featuredContainer = document.getElementById('featuredModels');
            featuredContainer.innerHTML = '<h3 class="mb-4">Featured 3D Models</h3>';
            
            models.slice(0, 4).forEach(model => {
                const modelCard = document.createElement('div');
                modelCard.className = 'feature-card';
                modelCard.innerHTML = `
                    <img src="${model.thumbnail}" alt="${model.name}" class="img-fluid mb-2">
                    <h5>${model.name}</h5>
                    <p class="text-muted">by ${model.creator.name}</p>
                    <a href="${model.public_url}" target="_blank" class="btn btn-primary btn-sm">
                        View Model <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                `;
                featuredContainer.appendChild(modelCard);
            });
        } catch (error) {
            console.error('Error fetching featured models:', error);
        }
    }

    async function likePost(contentId) {
        // Get userId from localStorage
        const userId = localStorage.getItem('userId');
        
        // Check if user is logged in
        if (!userId) {
            alert('Please log in to like posts');
            return;
        }
    
        const method = document.querySelector(`button[onclick="likePost('${contentId}')"] i`).classList.contains('fas') 
            ? 'DELETE' 
            : 'POST';
            
        try {
            const response = await fetch(`/M00915500/contents/${contentId}/like`, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
    
            if (response.ok) {
                // Toggle heart icon and update likes count
                const likeBtn = document.querySelector(`button[onclick="likePost('${contentId}')"]`);
                const icon = likeBtn.querySelector('i');
                const likesSpan = likeBtn.nextElementSibling;
                const currentLikes = parseInt(likesSpan.textContent);
                
                if (method === 'POST') {
                    icon.classList.replace('far', 'fas');
                    likesSpan.textContent = `${currentLikes + 1} Likes`;
                } else {
                    icon.classList.replace('fas', 'far');
                    likesSpan.textContent = `${currentLikes - 1} Likes`;
                }
            } else {
                throw new Error('Failed to update like status');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to update like status');
        }
    }

    async function addComment(event, contentId) {
        event.preventDefault();
        const userId = localStorage.getItem('userId');
        const comment = event.target.querySelector('input').value;
        const response = await fetch(`/M00915500/contents/${contentId}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, comment })
        });
        const result = await response.json();
        if (result.success) {
            alert('Comment added successfully!');
            fetchAndDisplayPosts(userId);
        } else {
            alert(result.error);
        }
    }

    function logout() {
        const userId = localStorage.getItem('userId');

        const xhr = new XMLHttpRequest();
        xhr.open('DELETE', '/M00915500/login', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    document.getElementById('forms').classList.remove('hidden');
                    document.getElementById('homePage').classList.add('hidden');
                    localStorage.removeItem('userId');
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send(JSON.stringify({ userId }));
    }

    document.getElementById('login').addEventListener('submit', function(event) {
        event.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/M00915500/login', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    localStorage.setItem('userId', result.userId);
                    showHomePage(result.userId);
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send(JSON.stringify({ username, password }));
    });

    document.getElementById('signup').addEventListener('submit', function(event) {
        event.preventDefault();
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/M00915500/users', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    alert('Signup successful! Please log in.');
                    toggleForms();
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send(JSON.stringify({ username, email, password }));
    });

    document.getElementById('createPostForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const userId = localStorage.getItem('userId');
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const images = document.getElementById('postImages').files;

        // Step 1: Create the post
        const createPostResponse = await fetch('/M00915500/contents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, title, content })
        });

        const createPostResult = await createPostResponse.json();
        if (!createPostResult.success) {
            alert(createPostResult.error);
            return;
        }

        const contentId = createPostResult.contentId;

        // Step 2: Upload images
        for (let i = 0; i < images.length; i++) {
            const formData = new FormData();
            formData.append('image', images[i]);

            const uploadImageResponse = await fetch(`/M00915500/contents/${contentId}/images?userId=${userId}`, {
                method: 'POST',
                body: formData
            });

            const uploadImageResult = await uploadImageResponse.json();
            if (!uploadImageResult.success) {
                alert(uploadImageResult.error);
                return;
            }
        }

        alert('Post created successfully!');
        showHomePage(userId);
    });

    document.getElementById('searchForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const userId = localStorage.getItem('userId');
        const query = document.getElementById('searchQuery').value;
        const searchType = document.getElementById('searchType').value;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/M00915500/${searchType}/search?q=${query}&userId=${userId}`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    const searchResults = document.getElementById('searchResults');
                    searchResults.innerHTML = '';
                    if (searchType === 'users') {
                        result.results.forEach(user => {
                            const userElement = document.createElement('div');
                            userElement.className = 'user';
                            userElement.innerHTML = `
                                <p>${user.username}</p>
                                <button class="btn btn-${user.isFollowing ? 'danger' : 'primary'}" onclick="${user.isFollowing ? 'unfollowUser' : 'followUser'}(${user.userId})">
                                    ${user.isFollowing ? 'Unfollow' : 'Follow'}
                                </button>
                            `;
                            searchResults.appendChild(userElement);
                        });
                    } else if (searchType === 'contents') {
                        result.results.forEach(content => {
                            const contentElement = document.createElement('div');
                            contentElement.className = 'card mb-3';
                            contentElement.innerHTML = `
                                <div class="card-body">
                                    <h3 class="card-title">${content.title}</h3>
                                    <p class="card-text">${content.content}</p>
                                    <small class="text-muted">Posted by ${content.username} on ${new Date(content.dateCreated).toLocaleString()}</small>
                                </div>
                            `;
                            if (content.images && content.images.length) {
                                content.images.forEach(image => {
                                    const imgElement = document.createElement('img');
                                    imgElement.src = image.url;
                                    imgElement.alt = 'Content Image';
                                    imgElement.className = 'card-img-top';
                                    contentElement.insertBefore(imgElement, contentElement.firstChild);
                                });
                            }
                            searchResults.appendChild(contentElement);
                        });
                    }
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send();
    });

    

    window.showForYouPage = function() {
        document.getElementById('forYouBtn').classList.add('btn-primary');
        document.getElementById('forYouBtn').classList.remove('btn-secondary');
        document.getElementById('followingBtn').classList.add('btn-secondary');
        document.getElementById('followingBtn').classList.remove('btn-primary');
        fetchAndDisplayForYouPosts();
    };

    window.showFollowingPage = function() {
        document.getElementById('followingBtn').classList.add('btn-primary');
        document.getElementById('followingBtn').classList.remove('btn-secondary');
        document.getElementById('forYouBtn').classList.add('btn-secondary');
        document.getElementById('forYouBtn').classList.remove('btn-primary');
        const userId = localStorage.getItem('userId');
        fetchAndDisplayPosts(userId);
    };

    function fetchAndDisplayPosts(userId) {
        // Fetch and display posts from followed users
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/M00915500/users/${userId}/following/posts`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    const postsContainer = document.getElementById('postsContainer');
                    postsContainer.innerHTML = '';
                    result.contents.forEach(post => {
                        const postElement = document.createElement('div');
                        postElement.className = 'card mb-3';
                        postElement.innerHTML = `
    <div class="card-body">
        <h3 class="card-title">${post.title}</h3>
        <p class="card-text">${post.content}</p>
        <small class="text-muted">Posted by ${post.username} on ${new Date(post.dateCreated).toLocaleString()}</small>
        <button class="btn btn-link like-btn" onclick="likePost('${post._id}')">
            <i class="fa${post.likes.includes(parseInt(userId)) ? 's' : 'r'} fa-heart"></i>
        </button>
        <span>${post.likes.length} Likes</span>
        <form onsubmit="addComment(event, '${post._id}')">
            <input type="text" placeholder="Add a comment" required>
            <button type="submit" class="btn btn-primary">Comment</button>
        </form>
        <div class="comments">
            ${post.comments.map(comment => `
                <p><strong>${comment.username}:</strong> ${comment.comment}</p>
            `).join('')}
        </div>
    </div>
`;
                    
                        if (post.images && post.images.length) {
                            post.images.forEach(image => {
                                const imgElement = document.createElement('img');
                                imgElement.src = image.url;
                                imgElement.alt = 'Post Image';
                                imgElement.className = 'card-img-top post-image'; // Add post-image class
                                postElement.insertBefore(imgElement, postElement.firstChild);
                            });
                        }
                        postsContainer.appendChild(postElement);
                    });
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send();
    }

    function fetchAndDisplayForYouPosts() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/M00915500/contents/forYou`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    const postsContainer = document.getElementById('postsContainer');
                    postsContainer.innerHTML = '';
                    result.contents.forEach(post => {
                        const postElement = document.createElement('div');
                        postElement.className = 'card mb-3';
                        postElement.innerHTML = `
                        <div class="card-body">
                            <h3 class="card-title">${post.title}</h3>
                            <p class="card-text">${post.content}</p>
                            <small class="text-muted">Posted by ${post.username} on ${new Date(post.dateCreated).toLocaleString()}</small>
                            <button class="btn btn-link like-btn" onclick="likePost('${post._id}')">
                                <i class="fa${post.likes.includes(parseInt(userId)) ? 's' : 'r'} fa-heart"></i>
                            </button>
                            <span>${post.likes.length} Likes</span>
                            <form onsubmit="addComment(event, '${post._id}')">
                                <input type="text" placeholder="Add a comment" required>
                                <button type="submit" class="btn btn-primary">Comment</button>
                            </form>
                            <div class="comments">
                                ${post.comments.map(comment => `
                                    <p><strong>${comment.username}:</strong> ${comment.comment}</p>
                                `).join('')}
                            </div>
                        </div>
                    `;
                    
                        if (post.images && post.images.length) {
                            post.images.forEach(image => {
                                const imgElement = document.createElement('img');
                                imgElement.src = image.url;
                                imgElement.alt = 'Post Image';
                                imgElement.className = 'card-img-top post-image'; // Add post-image class
                                postElement.insertBefore(imgElement, postElement.firstChild);
                            });
                        }
                        postsContainer.appendChild(postElement);
                    });
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send();
    }

    window.toggleForms = toggleForms;
    window.logout = logout;
    window.followUser = async function(userToFollowId) {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`/M00915500/follow/${userToFollowId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        const result = await response.json();
        if (result.success) {
            alert(`Successfully followed user ${userToFollowId}`);
            document.getElementById('searchUsersForm').dispatchEvent(new Event('submit'));
            fetchAndDisplayPosts(userId); // Refresh posts section
        } else {
            alert(result.error);
        }
    };
    window.unfollowUser = async function(userToUnfollowId) {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`/M00915500/follow/${userToUnfollowId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        const result = await response.json();
        if (result.success) {
            alert(`Successfully unfollowed user ${userToUnfollowId}`);
            document.getElementById('searchUsersForm').dispatchEvent(new Event('submit'));
            fetchAndDisplayPosts(userId); // Refresh posts section
        } else {
            alert(result.error);
        }
    };

    window.openModal = openModal;
    window.closeModal = closeModal;
    window.handleSubmit = handleSubmit;
    window.likePost = likePost;
    window.addComment = addComment;
    showFollowingPage();
});