const API_BASE = process.env.REACT_APP_API_BASE || "";
const AUTH_API = process.env.REACT_APP_AUTH_API || "/api/Auth";

// Local private variable to store the short-lived JWT safely in application memory
let _accessToken = null;

export async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}${AUTH_API}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password }),
            credentials: "include" // CRUCIAL FOR COOKIES
        });

        const data = await response.json();

        if (response.ok && data.accessToken) {
            _accessToken = data.accessToken; // Sets local variable
        }

        return {
            success: response.ok,
            status: response.status,
            data
        };
    } catch (error) {
        console.error("Auth HTTP Error:", error);
        return {
            success: false,
            status: 500,
            data: { message: "Cannot reach the authorization server." }
        };
    }
}

export function getAccessToken() {
    return _accessToken;
}

export async function logout() {
    try {
        const response = await fetch(`${API_BASE}${AUTH_API}/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include"
        });

        _accessToken = null; // Clear local variable memory
        console.log("In-memory JWT cleared.");
        
        return response.ok; 
        
    } catch (error) {
        console.error("Logout Error:", error);
        return false;
    }
}

// 1. FIXED: Now updates the internal local token variable and utilizes standard constants
export async function serviceTriggerSilentRefresh() {
    try {
        console.log(`Triggering manual POST request to: ${API_BASE}${AUTH_API}/refresh`);
        
        const response = await fetch(`${API_BASE}${AUTH_API}/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include" 
        });

        const data = await response.json();
        console.log("Refresh response status from server:", response.status);

        if (response.ok && data.accessToken) {
            _accessToken = data.accessToken; // ✅ Sync directly to local token store!
            return { success: true, token: data.accessToken };
        } else {
            return { success: false, message: data.message || "Failed to parse token." };
        }
    } catch (error) {
        console.error("Network error executing silent refresh:", error);
        return { success: false, message: "Server connection failure" };
    }
}

// 2. FIXED: Now pulls securely from the exact same internal local variable
export async function fetchSecureUsersList() {
    try {
        const token = _accessToken; // ✅ Reads from internal store perfectly!

        console.log(`Sending protected request to: ${API_BASE}/api/users with Bearer Token...`);
        
        const response = await fetch(`${API_BASE}/api/User`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            }
        });

        if (response.status === 401) {
            return { success: false, message: "401 Unauthorized! Access Denied." };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Secure fetch failure:", error);
        return { success: false, message: "Network Error" };
    }
}