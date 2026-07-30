import { apiFetch, API_BASE } from "./apiClient";

const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${cleanBase}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

export function mapTenderDto(dto) {
  const end = new Date(dto.endTime);
  const msLeft = Math.max(0, end.getTime() - Date.now());
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const isUrgent = hoursLeft > 0 && hoursLeft <= 2;

  return {
    id: String(dto.listingId),
    listingId: dto.listingId,
    assetId: dto.assetId,
    barcode: dto.barcodeSerial || "N/A",
    status: isUrgent ? "Closing soon" : dto.tenderStatusName || dto.assetStatusName,
    statusClass: isUrgent ? "status-urgent" : "status-active",
    category: dto.categoryName,
    title: dto.assetName,
    description: dto.description || "No description provided.",
    department: dto.departmentName,
    conditionGrade: dto.conditionName,
    leadingBid: dto.startingBid,
    recommendedBid: dto.recommendedPrice,
    startingBid: dto.startingBid,
    endTime: dto.endTime,
    startTime: dto.startTime,
    auctionEndsInHours: hoursLeft,
    image: resolveImageUrl(dto.imageUrl),
  };
}

export async function getPendingTenders() {
  const response = await apiFetch(`${cleanBase}/api/admin/tenders/pending`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load pending tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

export async function approveTender(listingId) {
  const response = await apiFetch(
    `${cleanBase}/api/admin/tenders/${listingId}/approve`,
    { method: "PUT" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to approve tender.");
  }
  return response.json().catch(() => ({ message: "Approved." }));
}

export async function rejectTender(listingId) {
  const response = await apiFetch(
    `${cleanBase}/api/admin/tenders/${listingId}/reject`,
    { method: "PUT" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to reject tender.");
  }
  return response.json().catch(() => ({ message: "Rejected." }));
}

export async function getAllAssets() {
  const response = await apiFetch(`${cleanBase}/api/tenders`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

export async function getAssetById(id) {
  const response = await apiFetch(`${cleanBase}/api/tenders/${id}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load tender.");
  }
  const dto = await response.json();
  return mapTenderDto(dto);
}
