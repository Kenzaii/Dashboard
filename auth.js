// Check if user is logged in
function checkAuth() {
    const user = sessionStorage.getItem('user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Update username in the header
    const userObj = JSON.parse(user);
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = userObj.username;
    }
    
    return userObj;
}

// Logout function
function logout() {
    // Show confirmation dialog
    const confirmLogout = confirm('Are you sure you want to logout?');
    
    if (confirmLogout) {
        // Clear session storage
        sessionStorage.removeItem('user');
        
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

// Initialize auth check when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
}); 