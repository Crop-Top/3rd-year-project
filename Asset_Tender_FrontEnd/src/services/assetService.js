import { apiFetch, API_BASE } from "./apiClient";

const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${cleanBase}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

export function mapTenderDto(dto) {
  const endRaw = dto.endTime ?? dto.EndTime;
  const end = new Date(endRaw);
  const msLeft = Math.max(0, end.getTime() - Date.now());
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const isUrgent = hoursLeft > 0 && hoursLeft <= 2;
  const listingId = dto.listingId ?? dto.ListingId;

  return {
    id: String(listingId),
    listingId,
    assetId: dto.assetId ?? dto.AssetId,
    barcode: dto.barcodeSerial ?? dto.BarcodeSerial ?? "N/A",
    status: isUrgent ? "Closing soon" : (dto.tenderStatusName ?? dto.TenderStatusName ?? dto.assetStatusName ?? dto.AssetStatusName),
    statusClass: isUrgent ? "status-urgent" : "status-active",
    category: dto.categoryName ?? dto.CategoryName,
    title: dto.assetName ?? dto.AssetName,
    description: (dto.description ?? dto.Description) || "No description provided.",
    department: dto.departmentName ?? dto.DepartmentName,
    conditionGrade: dto.conditionName ?? dto.ConditionName,
    leadingBid: dto.leadingBid ?? dto.LeadingBid ?? dto.startingBid ?? dto.StartingBid,
    recommendedBid: dto.recommendedPrice ?? dto.RecommendedPrice,
    startingBid: dto.startingBid ?? dto.StartingBid,
    endTime: endRaw,
    startTime: dto.startTime ?? dto.StartTime,
    auctionEndsInHours: hoursLeft,
    image: resolveImageUrl(dto.imageUrl ?? dto.ImageUrl),
    bidCount: dto.bidCount ?? dto.BidCount ?? 0,
    hasBids: dto.hasBids ?? dto.HasBids ?? ((dto.bidCount ?? dto.BidCount ?? 0) > 0),
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

/** Public featured tenders for the landing page (no auth). */
export async function getFeaturedTenders(limit = 3) {
  const response = await fetch(
    `${cleanBase}/api/public/tenders?limit=${encodeURIComponent(limit)}`
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load featured tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

/** Live Open/Active tenders for the Admin dashboard. */
export async function getLiveTendersForAdmin() {
  const response = await apiFetch(`${cleanBase}/api/admin/tenders/live`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load live tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

export async function getExpiredTenders() {
  const response = await apiFetch(`${cleanBase}/api/admin/tenders/expired`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load expired tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

export async function relistTender(listingId, endTime) {
  const response = await apiFetch(
    `${cleanBase}/api/admin/tenders/${listingId}/relist`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endTime }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to relist tender.");
  }
  return response.json().catch(() => ({ message: "Relisted." }));
}

export async function closeExpiredTender(listingId) {
  const response = await apiFetch(
    `${cleanBase}/api/admin/tenders/${listingId}/close`,
    { method: "PUT" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to close tender.");
  }
  return response.json().catch(() => ({ message: "Closed." }));
}

export async function cancelExpiredTender(listingId) {
  const response = await apiFetch(
    `${cleanBase}/api/admin/tenders/${listingId}/cancel`,
    { method: "PUT" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to cancel tender.");
  }
  return response.json().catch(() => ({ message: "Cancelled." }));
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
