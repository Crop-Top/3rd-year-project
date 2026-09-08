import { apiFetch, API_BASE_URL } from "./apiClient";

function mapDocument(dto) {
  return {
    documentId: dto.documentId ?? dto.DocumentId,
    documentName: dto.documentName ?? dto.DocumentName ?? "Untitled",
    category: dto.category ?? dto.Category ?? "General",
    uploadDate: dto.uploadDate ?? dto.UploadDate,
    visibleToInternal: Boolean(dto.visibleToInternal ?? dto.VisibleToInternal),
    visibleToExternal: Boolean(dto.visibleToExternal ?? dto.VisibleToExternal),
    uploadedByName: dto.uploadedByName ?? dto.UploadedByName ?? null,
  };
}

export async function listDocuments() {
  const response = await apiFetch(`${API_BASE_URL}/documents`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load documents.");
  }
  const rows = await response.json();
  const list = Array.isArray(rows) ? rows : rows?.$values || [];
  return list.map(mapDocument);
}

export async function uploadDocument({ file, documentName, category, visibleToInternal, visibleToExternal }) {
  const formData = new FormData();
  formData.append("file", file);
  if (documentName) formData.append("documentName", documentName);
  if (category) formData.append("category", category);
  formData.append("visibleToInternal", String(Boolean(visibleToInternal)));
  formData.append("visibleToExternal", String(Boolean(visibleToExternal)));

  const response = await apiFetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to upload document.");
  }

  return mapDocument(await response.json());
}

export async function downloadDocument(documentId, fallbackName = "document") {
  const response = await apiFetch(`${API_BASE_URL}/documents/${documentId}/download`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to download document.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
  const fileName = match
    ? decodeURIComponent(match[1].replace(/"/g, "").trim())
    : fallbackName;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function deleteDocument(documentId) {
  const response = await apiFetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to delete document.");
  }
}
