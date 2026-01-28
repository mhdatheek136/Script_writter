/**
 * Authentication service for API calls.
 * Handles login, logout, token storage, and auth state.
 */

const API_BASE = '';

// Token storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * Get stored auth token.
 */
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get stored user info.
 */
export function getUser() {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated() {
    return !!getToken();
}

/**
 * Check if user is admin.
 */
export function isAdmin() {
    const user = getUser();
    return user?.role === 'admin';
}

/**
 * Store auth data after login.
 */
function storeAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clear auth data on logout.
 */
function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

/**
 * Get authorization headers for API requests.
 */
export function getAuthHeaders() {
    const token = getToken();
    if (token) {
        return {
            'Authorization': `Bearer ${token}`
        };
    }
    return {};
}

/**
 * Login with email and password.
 */
export async function login(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();

    storeAuth(data.access_token, {
        id: data.user_id,
        email: data.email,
        role: data.role
    });

    return data;
}

/**
 * Logout current user.
 */
export async function logout() {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
    } catch (e) {
        // Ignore logout errors
    }
    clearAuth();
}

/**
 * Get current user info from API.
 */
export async function getCurrentUser() {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        if (response.status === 401) {
            clearAuth();
            return null;
        }
        throw new Error('Failed to get user info');
    }

    return response.json();
}

/**
 * Make authenticated API request.
 */
export async function authFetch(url, options = {}) {
    const headers = {
        ...options.headers,
        ...getAuthHeaders()
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Handle 401 by clearing auth
    if (response.status === 401) {
        clearAuth();
        window.location.reload();
    }

    return response;
}
