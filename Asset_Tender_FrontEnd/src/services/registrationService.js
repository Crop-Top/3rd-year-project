const API_BASE = process.env.REACT_APP_API_BASE || "";
const AUTH_API = process.env.REACT_APP_AUTH_API || "/api/Auth";

async function parseResponse(response) {
    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

export async function register(companyName, email, password) {
    const url = `${API_BASE}${AUTH_API}/register`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            companyName,
            email,
            password
        })
    });

    const data = await parseResponse(response);

    return {
        success: response.ok,
        status: response.status,
        data
    };
}
