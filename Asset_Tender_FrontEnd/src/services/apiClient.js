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

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  // 1. Send the original request
  let response = await fetch(url, { ...options, headers, credentials: "include" });

  // 2. Identify special endpoints
  const isRefreshEndpoint = url.includes("/Auth/refresh");
  const isLoginEndpoint = url.includes("/Auth/login"); // 👈 1. Detect login call

  // 3. ONLY run 401 refresh logic if it was NOT a login call AND NOT a refresh call
  if (response.status === 401 && !isRefreshEndpoint && !isLoginEndpoint) {
    const newToken = await refreshTokens();

    if (newToken) {
      // Retry original request with the new access token
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers, credentials: "include" });
    } else {
      // Refresh failed for an authenticated route -> clear state & navigate relatively
      localStorage.clear();

      const isIIS = window.location.pathname.toLowerCase().includes("grp-03-15");
      const basePath = isIIS ? "/grp-03-15/" : "/";

      // Prevent infinite reload if already on the landing page
      const currentPath = window.location.pathname.toLowerCase();
      if (!currentPath.startsWith(basePath.toLowerCase().slice(0, -1))) {
        window.location.href = basePath;
      }
    }
  }

  // 4. If it WAS /Auth/login returning 401, return response directly to handleSignIn!
  return response;
}