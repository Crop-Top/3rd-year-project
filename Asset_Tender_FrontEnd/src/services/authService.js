const API_BASE = process.env.REACT_APP_API_BASE || "";
const AUTH_API = process.env.REACT_APP_AUTH_API || "/api/Auth";

export async function login(username, password) {
    const response = await fetch(`${API_BASE}${AUTH_API}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    });

    const data = await response.json();

    return {
        success: response.ok,
        status: response.status,
        data
    };
}