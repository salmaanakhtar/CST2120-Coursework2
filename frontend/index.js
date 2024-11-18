document.addEventListener('DOMContentLoaded', function() {
    function toggleForms() {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        loginForm.classList.toggle('hidden');
        signupForm.classList.toggle('hidden');
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
                    showHomePage();
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
                    showHomePage();
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send(JSON.stringify({ username, email, password }));
    });

    function showHomePage() {
        document.getElementById('forms').classList.add('hidden');
        document.getElementById('homePage').classList.remove('hidden');
    }

    async function logout() {
        const username = document.getElementById('loginUsername').value;

        const xhr = new XMLHttpRequest();
        xhr.open('DELETE', '/M00915500/login', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    document.getElementById('forms').classList.remove('hidden');
                    document.getElementById('homePage').classList.add('hidden');
                } else {
                    alert(result.error);
                }
            }
        };
        xhr.send(JSON.stringify({ username }));
    }

    window.toggleForms = toggleForms;
    window.logout = logout;
});