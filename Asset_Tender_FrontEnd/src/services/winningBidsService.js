//import { apiFetch, API_BASE } from "./apiClient";
import { apiFetch, API_BASE_URL } from "./apiClient";

//const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

export async function getWinningBids() {
  const response = await apiFetch(`${API_BASE_URL}/bids/winning`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || data.Message || "An error occurred while processing your request."
    );
  }
  return response.json();
}
