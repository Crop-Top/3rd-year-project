namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class EditTenderDetailResponseDto
    {
        public int ListingId { get; set; }
        public int AssetId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string BarcodeSerial { get; set; } = string.Empty;
        public int? CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public int? DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public string CostCenter { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int? AssetConditionId { get; set; }
        public string ConditionName { get; set; } = string.Empty;
        public string ConditionNotes { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public decimal? RecommendedPrice { get; set; }
        public decimal? StartingBid { get; set; }
        public decimal? LeadingBid { get; set; }
        public string Status { get; set; } = string.Empty;

        // Audit Metadata
        public string UploadedBy { get; set; } = string.Empty;
        public string? ApprovedBy { get; set; }
        public string? RejectedBy { get; set; }
        public string? RejectionReason { get; set; }
    }
}
