//import { apiFetch, API_BASE } from "./apiClient";
import { apiFetch, API_BASE_URL } from "./apiClient";

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
  if (!dto) return {};

  const endRaw = dto.endTime ?? dto.EndTime;
  const end = endRaw ? new Date(endRaw) : null;
  const msLeft = end ? Math.max(0, end.getTime() - Date.now()) : 0;
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const isUrgent = hoursLeft > 0 && hoursLeft <= 2;

  const listingId = dto.listingId ?? dto.ListingId ?? null;
  const assetId = dto.AssetID ?? dto.assetId ?? null;
  const primaryId = listingId ?? assetId ?? String(Math.random());

  const startingBid = dto.startingBid ?? dto.StartingBid ?? dto.recommendedPrice ?? dto.RecommendedPrice ?? 0;
  const myOfferAmount = dto.myOfferAmount ?? dto.MyOfferAmount ?? null;

  return {
    id: String(primaryId),
    listingId,
    assetId,

    // --- Core SQL & Joined DTO Properties ---
    title: dto.assetName ?? dto.AssetName ?? dto.title ?? "Untitled Asset",
    barcode: dto.barcodeSerial ?? dto.BarcodeSerial ?? dto.Barcode_Serial ?? dto.barcode_Serial ?? dto.barcode ?? "N/A",
    category: dto.categoryName ?? dto.CategoryName ?? dto.CategoryID ?? dto.categoryID ?? dto.category ?? "N/A",
    department: dto.departmentName ?? dto.DepartmentName ?? dto.DepartmentID ?? dto.departmentID ?? dto.department ?? "N/A",

    // Extended field fallback checks:
    costCenter: dto.costCenter ?? dto.CostCenter ?? dto.costCenterName ?? dto.CostCenterName ?? dto.costCenterCode ?? dto.CostCenterCode ?? "N/A",
    location: dto.location ?? dto.Location ?? dto.locationName ?? dto.LocationName ?? dto.locationDescription ?? "N/A",
    uploadedBy: dto.uploadedBy ?? dto.UploadedBy ?? dto.uploadedByName ?? dto.UploadedByName ?? dto.uploadedByUsername ?? dto.UploadedByUsername ?? dto.createdBy ?? dto.CreatedBy ?? dto.uploaderName ?? dto.UploaderName ?? "N/A",

    description: dto.description ?? dto.Description ?? dto.assetDescription ?? dto.AssetDescription ?? "No description provided.",
    conditionGrade: dto.conditionName ?? dto.ConditionName ?? dto.AssetConditionID ?? dto.assetConditionID ?? "N/A",
    conditionNotes: dto.conditionNotes ?? dto.ConditionNotes ?? "",
    image: resolveImageUrl(dto.imageUrl ?? dto.ImageUrl ?? dto.ImageURL ?? dto.image),
    recommendedBid: dto.recommendedPrice ?? dto.RecommendedPrice ?? dto.recommendedBid ?? 0,
    status: isUrgent
      ? "Closing soon"
      : (dto.tenderStatusName ?? dto.TenderStatusName ?? dto.assetStatusName ?? dto.AssetStatusName ?? dto.AssetStatusID ?? dto.assetStatusID ?? "Pending"),
    approvedBy: dto.approvedBy ?? dto.ApprovedBy ?? null,
    rejectedBy: dto.rejectedBy ?? dto.RejectedBy ?? null,
    rejectionReason: dto.rejectionReason ?? dto.RejectionReason ?? null,

    // --- Auction Specific Properties ---
    statusClass: isUrgent ? "status-urgent" : "status-active",
    leadingBid: dto.leadingBid ?? dto.LeadingBid ?? startingBid,
    startingBid,
    myOfferAmount,
    hasSubmittedOffer: Boolean(dto.hasSubmittedOffer ?? dto.HasSubmittedOffer ?? (myOfferAmount != null)),
    endTime: endRaw,
    startTime: dto.startTime ?? dto.StartTime,
    auctionEndsInHours: hoursLeft,
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
  const rawArray = Array.isArray(rows) ? rows : rows?.$values || rows?.data || [];

  console.log("Raw Pending Tenders API Response:", rawArray); {/*TO REMOVE*/}

  return rawArray.map(mapTenderDto);
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
  const token = localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");

  if (!token) {
    throw new Error("You are not logged in. Please sign in to view your bids.");
  }

  const response = await fetch(`${API_BASE_URL}/bids/my-active`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

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

export async function rejectTender(listingId, reason = "") {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/tenders/${listingId}/reject`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: reason.trim()
      }),
    }
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
  const rawArray = Array.isArray(rows) ? rows : rows?.$values || rows?.data || [];
  return rawArray.map(mapTenderDto);
}

export async function getFeaturedTenders(limit = 3) {
  const response = await fetch(
    `${API_BASE_URL}/public/tenders?limit=${encodeURIComponent(limit)}`
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load featured tenders.");
  }
  const rows = await response.json();
  const rawArray = Array.isArray(rows) ? rows : rows?.$values || rows?.data || [];
  return rawArray.map(mapTenderDto);
}

export async function getLiveTendersForAdmin() {
  const response = await apiFetch(`${API_BASE_URL}/admin/tenders/live`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load live tenders.");
  }
  const rows = await response.json();
  const rawArray = Array.isArray(rows) ? rows : rows?.$values || rows?.data || [];
  return rawArray.map(mapTenderDto);
}

export async function getExpiredTenders() {
  const response = await apiFetch(`${API_BASE_URL}/admin/tenders/expired-unsold`);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.Message || "Failed to load expired tenders.");
  }

  const rawArray = Array.isArray(data)
    ? data
    : data?.$values || data?.data || data?.items || data?.result || [];

  return rawArray.map(mapTenderDto);
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