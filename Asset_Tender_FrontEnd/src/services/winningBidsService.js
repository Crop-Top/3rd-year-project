// winningBidsService.js

const API_BASE_URL = process.env.REACT_APP_API_BASE || ""; // Adjust to your backend URL

// Helper to get headers with the token
const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

// Generic response handler to handle 401 Session Expiry
const handleResponse = async (response) => {
  if (response.status === 401) {
    // Clear expired tokens and redirect to login
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    window.location.href = "/login?expired=true";
    throw new Error("Your session has expired or you are unauthorized. Please log in again.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "An error occurred while processing your request.");
  }

  return response.json();
};

export async function getWinningBids() {
  const response = await fetch(`${API_BASE_URL}/api/bids/winning`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse(response);
  
}

export async function uploadProofOfPayment(bidId, file) {
  const token = localStorage.getItem("accessToken");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bidId", bidId);

  // Note: Do not set 'Content-Type' when sending FormData; 
  // the browser will automatically set 'multipart/form-data' with the boundary.
  const response = await fetch(`${API_BASE_URL}/api/winning-bids/${bidId}/upload-pop`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });

  return handleResponse(response);
}