const API_BASE_URL = "https://localhost:7276/api";

// Safely extracts the JWT token from localStorage -> "user"
function getAuthToken() {
  try {
    const userString = localStorage.getItem("user");
    if (!userString) return null;

    const userData = JSON.parse(userString);

    // Checks common token property names (token, accessToken, jwt)
    return (
      userData.token ||
      userData.accessToken ||
      userData.jwt ||
      userData.jwtToken ||
      null
    );
  } catch (error) {
    console.error("Failed to parse 'user' from localStorage:", error);
    return null;
  }
}

async function handleResponse(response) {
  if (response.status === 401) {
    throw new Error(
      "Your session has expired or you are unauthorized. Please log in again."
    );
  }

  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    if (contentType && contentType.includes("application/json")) {
      const errorJson = await response.json();
      throw new Error(
        errorJson.message || errorJson.Message || `Error ${response.status}`
      );
    }
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }

  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }

  return null;
}

export async function getWinningBids() {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}/bids/winning`, {
    method: "GET",
    credentials: "include", // Ensures cookies like X-Refresh-Token are also sent
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      Accept: "application/json",
    },
  });

  return await handleResponse(response);
}

export async function uploadProofOfPayment(bidId, file) {
  const token = getAuthToken();
  const formData = new FormData();

  // Key name "File" matches public IFormFile File in C# DTO
  formData.append("File", file);

  const response = await fetch(`${API_BASE_URL}/bids/${bidId}/upload-pop`, {
    method: "POST",
    credentials: "include", // Ensures cookies like X-Refresh-Token are also sent
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: formData,
  });

  return await handleResponse(response);
}