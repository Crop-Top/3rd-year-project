import { apiFetch, API_BASE } from "./apiClient";

const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

function mapBidDto(dto) {
  return {
    bidId: dto.bidId ?? dto.BidId,
    listingId: dto.listingId ?? dto.ListingId,
    bidAmount: dto.bidAmount ?? dto.BidAmount,
    bidTimestamp: dto.bidTimestamp ?? dto.BidTimestamp,
    bidderId: dto.bidderId ?? dto.BidderId,
    bidderDisplayName: dto.bidderDisplayName ?? dto.BidderDisplayName ?? "Bidder",
    isLeading: dto.isLeading ?? dto.IsLeading ?? false,
  };
}

export async function getBidsForListing(listingId) {
  const response = await apiFetch(`${cleanBase}/api/tenders/${listingId}/bids`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.Message || "Failed to load bids.");
  }
  const rows = await response.json();
  return rows.map(mapBidDto);
}

export async function placeBid(listingId, amount) {
  const response = await apiFetch(`${cleanBase}/api/bids/PlaceBid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenderId: parseInt(listingId, 10),
      amount: parseFloat(amount),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.Message || "Failed to place bid.");
  }

  return {
    bidId: data.bidId ?? data.BidId,
    listingId: data.listingId ?? data.ListingId ?? listingId,
    bidAmount: data.bidAmount ?? data.BidAmount ?? amount,
    leadingBid: data.leadingBid ?? data.LeadingBid ?? amount,
    bidTimestamp: data.bidTimestamp ?? data.BidTimestamp,
    message: data.message || data.Message || "Bid placed successfully.",
  };
}