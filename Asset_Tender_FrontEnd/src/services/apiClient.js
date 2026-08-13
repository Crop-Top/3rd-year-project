// src/services/apiClient.js

export const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? 'https://localhost:7276/api'
  : '/grp-03-15/api';

// Helper to handle silent refresh via cookie
async function refreshTokens() {
  try {
    // 🚨 FIX 1: MUST use native fetch() here instead of apiFetch()
    // Using apiFetch here causes an infinite recursive loop when refresh fails.
    const res = await fetch(`${API_BASE_URL}/Auth/refresh`, {
      method: "POST",
      credentials: "include", // Sends HttpOnly refreshToken cookie to C#
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch (err) {
    console.error("Token refresh failed:", err);
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

  // Check if the URL requested is already the refresh endpoint
  const isRefreshEndpoint = url.includes("/Auth/refresh");

  // 🚨 FIX 2: Only attempt refresh if response is 401 AND we aren't ALREADY refreshing
  if (response.status === 401 && !isRefreshEndpoint) {
    const newToken = await refreshTokens();

    if (newToken) {
      // Retry original request with updated access token
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers, credentials: "include" });
    } else {
      // Refresh failed or session revoked -> force logout and break the chain
      localStorage.clear();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  }

  return response;
}