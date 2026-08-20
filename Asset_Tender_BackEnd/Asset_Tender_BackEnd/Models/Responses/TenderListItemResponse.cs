namespace Asset_Tender_BackEnd.Models.Responses;

public class TenderListItemResponse
{
    // Existing Listing / Tender properties
    public int ListingId { get; set; }
    public int AssetId { get; set; }
    public string AssetName { get; set; } = string.Empty;
    public string BarcodeSerial { get; set; } = string.Empty;
    public int? CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? DepartmentName { get; set; } = string.Empty;
    public string ConditionName { get; set; } = string.Empty;

    // Database Asset Fields
    public string Description { get; set; } = string.Empty;       // AssetDescription
    public string ConditionNotes { get; set; } = string.Empty;     // ConditionNotes
    public string? ImageUrl { get; set; }
    public decimal? RecommendedPrice { get; set; }
    public string AssetStatusName { get; set; } = string.Empty;

    public string CostCenter { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string UploadedBy { get; set; } = string.Empty;
    public string? ApprovedBy { get; set; }
    public string? RejectedBy { get; set; }
    public string? RejectionReason { get; set; }

    // Tender Specifics
    public decimal StartingBid { get; set; }
    public decimal LeadingBid { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string TenderStatusName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int BidCount { get; set; }
    public bool HasBids { get; set; }

    /// <summary>
    /// Current viewer's sealed offer on this lot, if any.
    /// </summary>
    public decimal? MyOfferAmount { get; set; }

    public bool HasSubmittedOffer { get; set; }

    public int? DepartmentID { get; set;  }

}
