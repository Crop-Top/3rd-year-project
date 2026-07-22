const API_BASE = process.env.REACT_APP_API_BASE || "";
const AUTH_API = process.env.REACT_APP_AUTH_API || "/Auth";
const USER_API = process.env.REACT_APP_USER_API || "/User"

// Local private variable to store the short-lived JWT safely in application memory
let _accessToken = null;

export async function login(username, password, turnstileToken) {
    try {
        const response = await fetch(`${API_BASE}${AUTH_API}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                username, 
                password,
                captchaToken: turnstileToken // <-- ADDED: Turnstile token sent to backend
            }),
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

// Manual or Interceptor based silent refresh agent
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
            _accessToken = data.accessToken; // Sync directly to local token store!
            return { success: true, token: data.accessToken };
        } else {
            return { success: false, message: data.message || "Failed to parse token." };
        }
    } catch (error) {
        console.error("Network error executing silent refresh:", error);
        return { success: false, message: "Server connection failure" };
    }
}

// Core fetch engine with integrated automated 401 interceptor loop
export async function fetchSecureUsersList() {
    try {
        let token = _accessToken; 

        console.log(`Sending protected request to: ${API_BASE}/User with Bearer Token...`);
        
        let response = await fetch(`${API_BASE}${USER_API}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            }
        });

        // THE INTERCEPTOR LOOP
        if (response.status === 401) {
            console.warn("Token expired (401). Attempting automatic silent refresh...");
            const refreshResult = await serviceTriggerSilentRefresh();

            if (refreshResult.success) {
                console.log("Silent refresh succeeded! Retrying user list request...");
                token = _accessToken; 
                response = await fetch(`${API_BASE}/User`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}` 
                    }
                });
            } else {
                console.error("Refresh token expired too. User must log in again.");
                return { success: false, message: "Session expired. Please log in again." };
            }
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Secure fetch failure:", error);
        return { success: false, message: "Network Error" };
    }
}

// ==================== 🛠️ NEW EXPORTS ADDED HERE ====================

// Core utility to decode a JWT payload architecture natively
export function decodeJwt(token) {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1]; // Slices out the middle payload segment
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            window.atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Failed to decode token architecture:", error);
        return null;
    }
}

// Clean helper interface to map server schemas to neat frontend claims
export function getCurrentUser() {
    const token = _accessToken;
    if (!token) return null;
    
    const claims = decodeJwt(token);
    if (!claims) return null;

    return {
        id: claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || claims.sub || claims.id,
        username: claims.unique_name || claims.username,
        email: claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] || claims.email,
        role: claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || claims.role,
        staffNumber: claims.StaffNumber || claims.ad_staff_num 
    };
}