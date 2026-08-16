//import { apiFetch, API_BASE } from "./apiClient";
import { apiFetch, API_BASE_URL } from "./apiClient";


//const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  let path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

  // Legacy disk paths are under the site root, not under /api.
  if (path.startsWith("/uploads/")) {
    const siteRoot = base.endsWith("/api") ? base.slice(0, -4) : base;
    return `${siteRoot}${path}`;
  }

  // API_BASE_URL already ends with /api; backend ImageUrl is /api/assets/{id}/image.
  if (base.endsWith("/api") && path.startsWith("/api/")) {
    path = path.slice(4);
  }

  return `${base}${path}`;
}

export { resolveImageUrl };

export function mapTenderDto(dto) {
  const endRaw = dto.endTime ?? dto.EndTime;
  const end = new Date(endRaw);
  const msLeft = Math.max(0, end.getTime() - Date.now());
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const isUrgent = hoursLeft > 0 && hoursLeft <= 2;
  const listingId = dto.listingId ?? dto.ListingId;
  const startingBid = dto.startingBid ?? dto.StartingBid;
  const myOfferAmount = dto.myOfferAmount ?? dto.MyOfferAmount ?? null;
  const hasSubmittedOffer = Boolean(
    dto.hasSubmittedOffer ?? dto.HasSubmittedOffer ?? (myOfferAmount != null)
  );

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
    leadingBid: dto.leadingBid ?? dto.LeadingBid ?? startingBid,
    recommendedBid: dto.recommendedPrice ?? dto.RecommendedPrice,
    startingBid,
    myOfferAmount,
    hasSubmittedOffer,
    endTime: endRaw,
    startTime: dto.startTime ?? dto.StartTime,
    auctionEndsInHours: hoursLeft,
    image: resolveImageUrl(dto.imageUrl ?? dto.ImageUrl),
    bidCount: dto.bidCount ?? dto.BidCount ?? 0,
    hasBids: dto.hasBids ?? dto.HasBids ?? ((dto.bidCount ?? dto.BidCount ?? 0) > 0),
  };
}

export async function getPendingTenders() {
  const response = await apiFetch(`${API_BASE_URL}/admin/tenders/pending`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load pending tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

export async function approveTender(listingId) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/tenders/${listingId}/approve`,
    { method: "PUT" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to approve tender.");
  }
  return response.json().catch(() => ({ message: "Approved." }));
}

export async function getMyActiveBids() {
  // 1. Ensure token exists (check both 'token' and common storage keys)
  const token = localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");

  if (!token) {
    throw new Error("You are not logged in. Please sign in to view your bids.");
  }

  // 2. Fetch active bids from backend
  const response = await fetch(`${API_BASE_URL}/bids/my-active`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  // 3. Handle non-200 responses safely
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Your session has expired or you are unauthorized. Please log in again.");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error ${response.status}: Failed to retrieve your active bids.`);
    }

    throw new Error(`Server returned status code ${response.status}`);
  }

  return await response.json();
}

export async function rejectTender(listingId) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/tenders/${listingId}/reject`,
    { method: "PUT" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to reject tender.");
  }
  return response.json().catch(() => ({ message: "Rejected." }));
}

export async function getAllAssets() {
  const response = await apiFetch(`${API_BASE_URL}/tenders`);
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
    `${API_BASE_URL}/public/tenders?limit=${encodeURIComponent(limit)}`
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
  const response = await apiFetch(`${API_BASE_URL}/admin/tenders/live`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load live tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

export async function getExpiredTenders() {
  const response = await apiFetch(`${API_BASE_URL}/admin/tenders/expired`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load expired tenders.");
  }
  const rows = await response.json();
  return rows.map(mapTenderDto);
}

export async function relistTender(listingId, endTime) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/tenders/${listingId}/relist`,
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
    `${API_BASE_URL}/admin/tenders/${listingId}/close`,
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
    `${API_BASE_URL}/admin/tenders/${listingId}/cancel`,
    { method: "PUT" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to cancel tender.");
  }
  return response.json().catch(() => ({ message: "Cancelled." }));
}

/** Mark unsold expired lot as Donation or Scrap. */
export async function disposeExpiredTender(listingId, disposition) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/tenders/${listingId}/dispose`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disposition }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to dispose tender.");
  }
  return response.json().catch(() => ({ message: "Disposed." }));
}

export async function getAssetById(id) {
  const response = await apiFetch(`${API_BASE_URL}/tenders/${id}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load tender.");
  }
  const dto = await response.json();
  return mapTenderDto(dto);
}
