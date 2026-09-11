namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class EscalatedAwardNotification
    {
        public int ListingID { get; set; }
        public int BidderID { get; set; }
        public string BidderEmail { get; set; } = string.Empty;
        public decimal BidAmount { get; set; }
    }
}
