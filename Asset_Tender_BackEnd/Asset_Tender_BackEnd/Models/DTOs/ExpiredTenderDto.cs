namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class ExpiredTenderDto
    {
        public int ListingId { get; set; }
        public int AssetId { get; set; }
        public string AssetName { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public decimal StartingBid { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int BidCount { get; set; }
        public decimal LeadingBid { get; set; }
        public bool HasBids { get; set; }

        /// <summary>True when tender was closed as won and still awaits Proof of Payment.</summary>
        public bool IsClosedAsWon { get; set; }

        public bool HasProofOfPayment { get; set; }

        public string? PaymentStatus { get; set; }

        public int? InvoiceId { get; set; }

        public decimal? WinningBidAmount { get; set; }

        public string? WinnerName { get; set; }
    }
}
