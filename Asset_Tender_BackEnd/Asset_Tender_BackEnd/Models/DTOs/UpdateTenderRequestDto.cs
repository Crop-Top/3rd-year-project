namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class UpdateTenderRequestDto
    {
        public string Title { get; set; } = string.Empty;
        public string BarcodeSerial { get; set; } = string.Empty;
        public int CategoryId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public string CostCenter { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int AssetConditionId { get; set; }
        public string ConditionNotes { get; set; } = string.Empty;
        public decimal RecommendedPrice { get; set; }
        public decimal StartingBid { get; set; }
        public string? ImageUrl { get; set; }
    }
}
