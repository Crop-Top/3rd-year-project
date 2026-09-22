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

    // --- Status ID Mapping ---
    tenderStatusId: Number(dto.tenderStatusId ?? dto.TenderStatusId ?? dto.statusId ?? dto.StatusId ?? 0),

    // --- Core SQL & Joined DTO Properties ---
    title: dto.assetName ?? dto.AssetName ?? dto.title ?? "Untitled Asset",
    barcode: dto.barcodeSerial ?? dto.BarcodeSerial ?? dto.Barcode_Serial ?? dto.barcode_Serial ?? dto.barcode ?? "N/A",
    category: dto.categoryName ?? dto.CategoryName ?? dto.CategoryID ?? dto.categoryID ?? dto.category ?? "N/A",
    department: dto.departmentName ?? dto.DepartmentName ?? dto.DepartmentID ?? dto.departmentID ?? dto.department ?? "N/A",

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
    viewingDate: dto.viewingDate ?? dto.ViewingDate ?? null,
    viewingEndTime: dto.viewingEndTime ?? dto.ViewingEndTime ?? null,
    viewingLocation: dto.viewingLocation ?? dto.ViewingLocation ?? null,
    auctionEndsInHours: hoursLeft,
    bidCount: dto.bidCount ?? dto.BidCount ?? 0,
    hasBids: dto.hasBids ?? dto.HasBids ?? ((dto.bidCount ?? dto.BidCount ?? 0) > 0),

    // Proof of Payment / closed-as-won (Expired Tenders)
    isClosedAsWon: Boolean(dto.isClosedAsWon ?? dto.IsClosedAsWon),
    hasProofOfPayment: Boolean(dto.hasProofOfPayment ?? dto.HasProofOfPayment),
    paymentStatus: dto.paymentStatus ?? dto.PaymentStatus ?? null,
    invoiceId: dto.invoiceId ?? dto.InvoiceId ?? null,
    winningBidAmount: dto.winningBidAmount ?? dto.WinningBidAmount ?? null,
    winnerName: dto.winnerName ?? dto.WinnerName ?? null,
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
  const response = await apiFetch(`${API_BASE_URL}/admin/tenders/expired`);

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

export async function uploadProofOfPayment(listingId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch(
    `${API_BASE_URL}/admin/proof-of-payment/${listingId}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || data.Message || "Failed to upload proof of payment."
    );
  }

  return response.json().catch(() => ({ message: "Proof of payment uploaded." }));
}

export async function fetchProofOfPayment(listingId) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/proof-of-payment/${listingId}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || data.Message || "Failed to load proof of payment."
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
  const fileName = match?.[1]
    ? decodeURIComponent(match[1].replace(/["']/g, ""))
    : `proof-of-payment-${listingId}`;
  const contentType =
    response.headers.get("Content-Type") || blob.type || "application/octet-stream";

  return { blob, fileName, contentType };
}

export async function downloadProofOfPayment(listingId) {
  const { blob, fileName } = await fetchProofOfPayment(listingId);

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// export async function cancelExpiredTender(listingId) {
//   const response = await apiFetch(
//     `${API_BASE_URL}/admin/tenders/${listingId}/cancel`,
//     { method: "PUT" }
//   );
//   if (!response.ok) {
//     const data = await response.json().catch(() => ({}));
//     throw new Error(data.message || data.Message || "Failed to cancel tender.");
//   }
//   return response.json().catch(() => ({ message: "Cancelled." }));
// }

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

export async function retractTender(listingId, reason = "") {
  const response = await apiFetch(`${API_BASE_URL}/Tenders/${listingId}/retract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: reason.trim() }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to retract tender.");
  }

  return response.json().catch(() => ({ message: "Tender retracted successfully." }));
}

export async function cancelExpiredTender(listingId, reason = "") {
  const response = await apiFetch(`${API_BASE_URL}/admin/tenders/${listingId}/cancel`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: reason.trim() }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.Message || errorData.message || "Failed to cancel expired tender.");
  }

  return response.json().catch(() => ({ message: "Expired tender cancelled successfully." }));
}

// export async function getPendingInvoiceRequests() {
//   // Replace with your actual endpoint route
//   return await apiFetch('/api/invoices/pending');
// }

export async function getPendingInvoiceRequests() {
  const response = await apiFetch(`${API_BASE_URL}/invoices/pending`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load pending invoice requests.");
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : rows?.$values || rows?.data || [];
}

export async function getInvoicedInvoiceRequests() {
  let response;
  try {
    response = await apiFetch(`${API_BASE_URL}/invoices/invoiced`);
  } catch (err) {
    const raw = err?.message || String(err);
    if (/networkerror|failed to fetch|network request failed/i.test(raw)) {
      throw new Error(
        "Could not reach the API for issued invoices. Confirm the backend is running and AddInvoiceRequestFileColumns.sql has been applied."
      );
    }
    throw new Error(raw || "Failed to load issued invoices.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load issued invoices.");
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : rows?.$values || rows?.data || [];
}

export async function fetchInvoiceFile(requestId) {
  const response = await apiFetch(`${API_BASE_URL}/invoices/${requestId}/file`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load invoice file.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
  const fileName = match?.[1]
    ? decodeURIComponent(match[1].replace(/["']/g, ""))
    : `invoice-${requestId}.pdf`;
  const contentType =
    response.headers.get("Content-Type") || blob.type || "application/pdf";

  return { blob, fileName, contentType };
}

export async function downloadInvoiceFile(requestId) {
  const { blob, fileName } = await fetchInvoiceFile(requestId);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function resendInvoice(requestId) {
  const response = await apiFetch(`${API_BASE_URL}/invoices/${requestId}/resend`, {
    method: "POST",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to resend invoice.");
  }
  return response.json().catch(() => ({ message: "Invoice resent successfully." }));
}

export async function attachInvoiceFile(requestId, invoiceFile, sendEmail = false) {
  const formData = new FormData();
  formData.append("file", invoiceFile);
  formData.append("sendEmail", String(sendEmail));

  const response = await apiFetch(`${API_BASE_URL}/invoices/${requestId}/attach`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to attach invoice file.");
  }
  return response.json().catch(() => ({ message: "Invoice file stored successfully." }));
}

export async function uploadAndSendInvoice(requestId, invoiceFile) {
  const formData = new FormData();
  // 👇 Change these keys to match your C# UploadInvoiceDto properties exactly
  formData.append("invoiceRequestId", requestId);
  formData.append("file", invoiceFile);

  const response = await apiFetch(`${API_BASE_URL}/invoices/upload-and-send`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to upload and send invoice.");
  }
  return response.json().catch(() => ({ message: "Invoice sent successfully." }));
}

export async function submitInvoiceRequest(dto) {
  const response = await apiFetch(`${API_BASE_URL}/invoices/request`, {
    method: "POST", // <-- Must be explicitly POST
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to submit invoice request.");
  }

  return response.json();
}

export async function getCurrentUserProfile() {
  const response = await apiFetch(`${API_BASE_URL}/User/me`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || data.Message || `Failed to fetch user profile (Status: ${response.status})`
    );
  }
  return response.json();
}

// export async function getCurrentUserProfile() {
//   const url = `${API_BASE_URL}/Users/me`;
//   console.log("🔍 [1. API CALL] Requesting user profile from:", url);

//   const response = await apiFetch(url);
//   console.log("🔍 [2. RESPONSE STATUS]:", response.status, response.statusText);

//   const contentType = response.headers.get("content-type") || "";
//   console.log("🔍 [3. CONTENT TYPE]:", contentType);

//   // Read response as text first to inspect raw output without throwing syntax errors
//   const rawText = await response.text();
//   console.log("🔍 [4. RAW RESPONSE BODY]:", rawText);

//   if (!response.ok || !contentType.includes("application/json")) {
//     throw new Error(
//       `API returned status ${response.status} with non-JSON content: ${rawText.slice(0, 100)}...`
//     );
//   }

//   // Parse JSON safely from text
//   const userData = JSON.parse(rawText);
//   console.log("🔍 [5. PARSED USER DATA]:", userData);
//   return userData;
// }