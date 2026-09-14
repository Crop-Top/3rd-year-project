import { API_BASE_URL, apiFetch } from "./apiClient.js";

export async function submitInvoiceRequest(invoiceData) {
  const token = localStorage.getItem("token");
  const response = await apiFetch(`${API_BASE_URL}/invoice/request`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(invoiceData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to submit invoice request.");
  }

  return await response.json();
}