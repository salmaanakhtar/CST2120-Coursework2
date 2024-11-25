document.addEventListener('DOMContentLoaded', function() {
    function toggleForms() {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        loginForm.classList.toggle('hidden');
        signupForm.classList.toggle('hidden');
    }

    function showHomePage(userId) {
        document.getElementById('forms').classList.add('hidden');
        document.getElementById('homePage').classList.remove('hidden');

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

    document.getElementById('searchUsersForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const userId = localStorage.getItem('userId');
        const query = document.getElementById('searchUsersQuery').value;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/M00915500/users/search?q=${query}&userId=${userId}`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    const searchUsersResults = document.getElementById('searchUsersResults');
                    searchUsersResults.innerHTML = '';
                    result.results.forEach(user => {
                        const userElement = document.createElement('div');
                        userElement.className = 'user';
                        userElement.innerHTML = `
                            <p>${user.username}</p>
                            <button class="btn btn-${user.isFollowing ? 'danger' : 'primary'}" onclick="${user.isFollowing ? 'unfollowUser' : 'followUser'}(${user.userId})">
                                ${user.isFollowing ? 'Unfollow' : 'Follow'}
                            </button>
                        `;
                        searchUsersResults.appendChild(userElement);
                    });
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send();
    });

    document.getElementById('searchContentsForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const userId = localStorage.getItem('userId');
        const query = document.getElementById('searchContentsQuery').value;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/M00915500/contents/search?q=${query}&userId=${userId}`, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    const searchContentsResults = document.getElementById('searchContentsResults');
                    searchContentsResults.innerHTML = '';
                    result.results.forEach(content => {
                        const contentElement = document.createElement('div');
                        contentElement.className = 'content';
                        contentElement.innerHTML = `
                            <h3>${content.title}</h3>
                            <p>${content.content}</p>
                            <small>Posted by ${content.username} on ${new Date(content.dateCreated).toLocaleString()}</small>
                        `;
                        if (content.images && content.images.length) {
                            content.images.forEach(image => {
                                const imgElement = document.createElement('img');
                                imgElement.src = image.url;
                                imgElement.alt = 'Content Image';
                                imgElement.style.maxWidth = '100%';
                                contentElement.appendChild(imgElement);
                            });
                        }
                        searchContentsResults.appendChild(contentElement);
                    });
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send();
    });

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
        } else {
            alert(result.error);
        }
    };
});