// src/services/apiClient.js

// const API_BASE = process.env.REACT_APP_API_BASE || "https://localhost:7276/";
// const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

// export { API_BASE };

export const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? 'https://localhost:7276/api'
  : '/api';

// Usage in components:
// fetch(`${API_BASE_URL}/Auth/login`, { method: 'POST', ... });

// Helper to handle silent refresh via cookie
async function refreshTokens() {
  try {
    const res = await apiFetch(`${API_BASE_URL}/Auth/refresh`, {
      method: "POST",
      credentials: "include", // 👈 Crucial: sends X-Refresh-Token cookie to C#
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

// Wrapper for standard fetch
export async function apiFetch(url, options = {}) {
  let token = localStorage.getItem("accessToken");

  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Let the browser set multipart boundary for FormData; otherwise default to JSON.
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Include credentials by default for all API requests
  let response = await fetch(url, { ...options, headers, credentials: "include" });

  // If unauthorized, attempt silent token refresh
  if (response.status === 401) {
    const newToken = await refreshTokens();

    if (newToken) {
      // Retry original request with updated access token
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers, credentials: "include" });
    } else {
      // Refresh failed or session revoked -> force logout
      localStorage.clear();
      window.location.href = "/login";
    }
  }

  return response;
}
