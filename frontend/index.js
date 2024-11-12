document.addEventListener('DOMContentLoaded', function() {
    function toggleForms() {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        loginForm.classList.toggle('hidden');
        signupForm.classList.toggle('hidden');
    }

    document.getElementById('login').addEventListener('submit', async function(event) {
        event.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        const response = await fetch('/M00915500/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        if (result.success) {
            showHomePage();
        } else {
            alert(result.error);
        }
    });

    document.getElementById('signup').addEventListener('submit', async function(event) {
        event.preventDefault();
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        const response = await fetch('/M00915500/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const result = await response.json();
        if (result.success) {
            showHomePage();
        } else {
            alert(result.error);
        }
    });

    function showHomePage() {
        document.getElementById('forms').classList.add('hidden');
        document.getElementById('homePage').classList.remove('hidden');
    }

    async function logout() {
        const username = document.getElementById('loginUsername').value;

        const response = await fetch('/M00915500/login', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        const result = await response.json();
        if (result.success) {
            document.getElementById('forms').classList.remove('hidden');
            document.getElementById('homePage').classList.add('hidden');
        } else {
            alert(result.error);
        }
    }

    window.toggleForms = toggleForms;
    window.logout = logout;
});