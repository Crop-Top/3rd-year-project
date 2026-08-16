namespace Asset_Tender_BackEnd.Models.Responses;

public class TenderListItemResponse
{
    public int ListingId { get; set; }

    public int AssetId { get; set; }

    public string AssetName { get; set; } = string.Empty;

    public string? BarcodeSerial { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string DepartmentName { get; set; } = string.Empty;

    public string ConditionName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public decimal StartingBid { get; set; }

    /// <summary>
    /// Highest placed bid, or StartingBid when no bids exist yet.
    /// For Staff/Bidder while a lot is still open, this is sealed (StartingBid only).
    /// </summary>
    public decimal LeadingBid { get; set; }

    public decimal RecommendedPrice { get; set; }

    public string? ImageUrl { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public string AssetStatusName { get; set; } = string.Empty;

    public string TenderStatusName { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public int BidCount { get; set; }

    public bool HasBids { get; set; }

    /// <summary>
    /// Current viewer's sealed offer on this lot, if any.
    /// </summary>
    public decimal? MyOfferAmount { get; set; }

    public bool HasSubmittedOffer { get; set; }
}
