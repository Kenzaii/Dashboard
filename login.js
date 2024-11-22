class AirtableAuth {
    constructor() {
        this.baseId = 'appCcEuHrMg1fP0GZ';
        this.apiKey = 'patTUtoTjm52HM0XT.7e96a55bb8b9daad18614eddc178520bc23ab86a4ae493fdc2fda0ced63cc205';
        this.tableName = 'Users';
        this.baseURL = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    }

    async validateCredentials(username, password) {
        try {
            // Formula to filter by username
            const formula = encodeURIComponent(`{Username} = '${username}'`);
            const url = `${this.baseURL}?filterByFormula=${formula}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Authentication failed');
            }

            const data = await response.json();
            
            if (data.records.length === 0) {
                return { success: false, message: 'Invalid username or password' };
            }

            const user = data.records[0].fields;

            // Check if password matches and account is active
            if (user.Password === password && user.Status === 'Active') {
                // Update last login time
                await this.updateLastLogin(data.records[0].id);
                
                // Store user info in session
                sessionStorage.setItem('user', JSON.stringify({
                    username: user.Username,
                    role: user.Role,
                    email: user.Email
                }));

                return { success: true };
            } else {
                return { success: false, message: 'Invalid username or password' };
            }

        } catch (error) {
            console.error('Auth error:', error);
            return { success: false, message: 'Authentication failed' };
        }
    }

    async updateLastLogin(recordId) {
        try {
            await fetch(`${this.baseURL}/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        'Last Login': new Date().toISOString()
                    }
                })
            });
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }
}

// Initialize login functionality
document.addEventListener('DOMContentLoaded', () => {
    const auth = new AirtableAuth();
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Show loading state
        const button = loginForm.querySelector('button');
        button.disabled = true;
        button.textContent = 'Logging in...';
        errorMessage.textContent = '';

        try {
            const result = await auth.validateCredentials(username, password);
            
            if (result.success) {
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = result.message;
                button.disabled = false;
                button.textContent = 'Login';
            }
        } catch (error) {
            errorMessage.textContent = 'An error occurred. Please try again.';
            button.disabled = false;
            button.textContent = 'Login';
        }
    });
}); 