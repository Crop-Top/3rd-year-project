import { apiFetch, API_BASE_URL } from "./apiClient";

function mapDocument(dto) {
  return {
    documentId: dto.documentId ?? dto.DocumentId,
    documentName: dto.documentName ?? dto.DocumentName ?? "Untitled",
    categoryId: dto.categoryId ?? dto.CategoryId ?? null,
    categoryName: dto.categoryName ?? dto.CategoryName ?? dto.category ?? dto.Category ?? "General",
    uploadDate: dto.uploadDate ?? dto.UploadDate,
    visibleToInternal: Boolean(dto.visibleToInternal ?? dto.VisibleToInternal),
    visibleToExternal: Boolean(dto.visibleToExternal ?? dto.VisibleToExternal),
    uploadedByName: dto.uploadedByName ?? dto.UploadedByName ?? null,
  };
}

function mapCategory(dto) {
  return {
    categoryId: dto.categoryId ?? dto.CategoryId ?? dto.documentCategoryId ?? dto.DocumentCategoryId,
    categoryName: dto.categoryName ?? dto.CategoryName ?? "",
    displayOrder: dto.displayOrder ?? dto.DisplayOrder ?? 0,
  };
}

function extractErrorMessage(data, fallback) {
  return (
    data?.message ||
    data?.Message ||
    data?.title ||
    data?.Title ||
    fallback
  );
}

function extensionMime(fileName) {
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return null;
  }
}

function sniffMimeFromBytes(bytes) {
  if (!bytes || bytes.length < 4) return null;

  // %PDF
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // ZIP-based Office (DOCX/XLSX) — PK..
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  ) {
    return "application/zip";
  }

  return null;
}

function isGenericMime(mime) {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  return !m || m === "application/octet-stream" || m === "binary/octet-stream";
}

function parseContentDispositionFileName(disposition) {
  if (!disposition) return null;
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(disposition);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      return star[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  const plain = /filename=(?:"([^"]+)"|([^;]+))/i.exec(disposition);
  if (plain) {
    return (plain[1] || plain[2] || "").trim();
  }
  return null;
}

function resolveDocumentMime({ headerType, blobType, fileName, bytes }) {
  const header = (headerType || "").split(";")[0].trim();
  const blob = (blobType || "").split(";")[0].trim();

  if (!isGenericMime(header) && !header.toLowerCase().includes("zip")) {
    return header;
  }
  if (!isGenericMime(blob) && !blob.toLowerCase().includes("zip")) {
    return blob;
  }

  const fromName = extensionMime(fileName);
  if (fromName) return fromName;

  const sniffed = sniffMimeFromBytes(bytes);
  if (sniffed && sniffed !== "application/zip") return sniffed;

  // ZIP without extension: leave as octet-stream (Office fallback in UI)
  if (sniffed === "application/zip") {
    return fromName || "application/octet-stream";
  }

  return header || blob || "application/octet-stream";
}

export async function listDocuments() {
  const response = await apiFetch(`${API_BASE_URL}/documents`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(data, "Failed to load documents."));
  }
  const rows = await response.json();
  const list = Array.isArray(rows) ? rows : rows?.$values || [];
  return list.map(mapDocument);
}

export async function listDocumentCategories() {
  const response = await apiFetch(`${API_BASE_URL}/documents/categories`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(data, "Failed to load document categories."));
  }
  const rows = await response.json();
  const list = Array.isArray(rows) ? rows : rows?.$values || [];
  return list.map(mapCategory);
}

export async function createDocumentCategory(categoryName) {
  const response = await apiFetch(`${API_BASE_URL}/documents/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryName }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(data, "Failed to create category."));
  }

  return mapCategory(await response.json());
}

export async function uploadDocument({
  file,
  documentName,
  documentCategoryId,
  visibleToInternal,
  visibleToExternal,
}) {
  const formData = new FormData();
  formData.append("file", file);
  if (documentName) formData.append("documentName", documentName);
  formData.append("documentCategoryId", String(documentCategoryId));
  formData.append("visibleToInternal", String(Boolean(visibleToInternal)));
  formData.append("visibleToExternal", String(Boolean(visibleToExternal)));

  const response = await apiFetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(data, "Failed to upload document."));
  }

  return mapDocument(await response.json());
}

export async function fetchDocumentForPreview(documentId, fallbackName = "document") {
  const response = await apiFetch(`${API_BASE_URL}/documents/${documentId}/download`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const raw = extractErrorMessage(data, "Failed to load document preview.");
    const lower = String(raw).toLowerCase();
    if (lower.includes("missing on the server") || lower.includes("file is missing")) {
      throw new Error(
        "This document’s file is missing on the server (DB row exists but the file is gone). Super Admin should re-upload it."
      );
    }
    throw new Error(raw);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const headerType = response.headers.get("Content-Type") || "";
  const disposition = response.headers.get("Content-Disposition") || "";
  const fileName =
    parseContentDispositionFileName(disposition) || fallbackName || "document";

  const contentType = resolveDocumentMime({
    headerType,
    blobType: "",
    fileName,
    bytes,
  });

  const blob = new Blob([buffer], { type: contentType });

  return { blob, contentType, fileName };
}

export async function downloadDocument(documentId, fallbackName = "document") {
  const { blob, fileName } = await fetchDocumentForPreview(documentId, fallbackName);

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
    throw new Error(extractErrorMessage(data, "Failed to delete document."));
  }
}
