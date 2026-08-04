import { apiFetch, API_BASE } from "./apiClient";

const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

function extractApiError(data, fallback) {
  if (!data || typeof data !== "object") return fallback;

  if (data.message || data.Message) {
    return data.message || data.Message;
  }

  // ASP.NET validation problem details: { errors: { Field: ["msg"] } }
  if (data.errors && typeof data.errors === "object") {
    const parts = Object.entries(data.errors).flatMap(([field, msgs]) => {
      const list = Array.isArray(msgs) ? msgs : [msgs];
      return list.map((m) => `${field}: ${m}`);
    });
    if (parts.length) return parts.join(" ");
  }

  // Legacy ModelState dictionary shape
  const flat = Object.entries(data)
    .filter(([key]) => key !== "type" && key !== "title" && key !== "status" && key !== "traceId")
    .flatMap(([key, val]) => {
      if (Array.isArray(val)) return val.map((m) => `${key}: ${m}`);
      if (typeof val === "string") return [`${key}: ${val}`];
      return [];
    });

  return flat.length ? flat.join(" ") : fallback;
}

function normalizeCategory(c) {
  return {
    categoryId: c.categoryId ?? c.CategoryId,
    categoryName: c.categoryName ?? c.CategoryName,
  };
}

function normalizeDepartment(d) {
  return {
    departmentId: d.departmentId ?? d.departmentID ?? d.DepartmentId ?? d.DepartmentID,
    departmentName: d.departmentName ?? d.DepartmentName,
  };
}

export async function getCategories() {
  const response = await apiFetch(`${cleanBase}/api/Lookups/categories`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractApiError(data, "Failed to load categories."));
  }
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map(normalizeCategory);
}

export async function getDepartments() {
  const response = await apiFetch(`${cleanBase}/api/Lookups/departments`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractApiError(data, "Failed to load departments."));
  }
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map(normalizeDepartment);
}

export async function createCategory(categoryName) {
  const response = await apiFetch(`${cleanBase}/api/Lookups/categories`, {
    method: "POST",
    body: JSON.stringify({ categoryName }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractApiError(data, "Failed to create category."));
  }

  return normalizeCategory(await response.json());
}

export async function createTender(formData) {
  const response = await apiFetch(`${cleanBase}/api/admin/tenders`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractApiError(data, "Failed to publish tender."));
  }

  return response.json();
}
