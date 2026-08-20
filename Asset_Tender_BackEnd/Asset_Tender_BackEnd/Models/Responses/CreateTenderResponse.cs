namespace Asset_Tender_BackEnd.Models.Responses;

public class CreateTenderResponse
{
    public int ListingId { get; set; }
    public int AssetId { get; set; }
    public string AssetName { get; set; } = string.Empty;
    public string? BarcodeSerial { get; set; }
    public decimal RecommendedPrice { get; set; }
    public decimal StartingBid { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? ImageUrl { get; set; }
    public string Message { get; set; } = string.Empty;

    public string? DepartmentName { get; set; }
    public string? UploadedByName { get; set; }

    public string? AssetDescription { get; set; }
}
