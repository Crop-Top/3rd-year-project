import { apiFetch, API_BASE } from "./apiClient";

const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

export async function getCategories() {
  const response = await apiFetch(`${cleanBase}/api/Lookups/categories`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load categories.");
  }
  return response.json();
}

export async function getDepartments() {
  const response = await apiFetch(`${cleanBase}/api/Lookups/departments`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load departments.");
  }
  return response.json();
}

export async function createCategory(categoryName) {
  const response = await apiFetch(`${cleanBase}/api/Lookups/categories`, {
    method: "POST",
    body: JSON.stringify({ categoryName }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to create category.");
  }

  return response.json();
}

export async function createTender(formData) {
  const response = await apiFetch(`${cleanBase}/api/admin/tenders`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      data.message ||
      data.Message ||
      (typeof data === "object" ? Object.values(data).flat().join(" ") : null) ||
      "Failed to publish tender.";
    throw new Error(message);
  }

  return response.json();
}
