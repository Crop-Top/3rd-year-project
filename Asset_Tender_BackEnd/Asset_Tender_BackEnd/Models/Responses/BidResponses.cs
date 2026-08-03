namespace Asset_Tender_BackEnd.Models.Responses;

public class BidListItemResponse
{
    public int BidId { get; set; }

    public int ListingId { get; set; }

    public decimal BidAmount { get; set; }

    public DateTime BidTimestamp { get; set; }

    public int BidderId { get; set; }

    public string BidderDisplayName { get; set; } = string.Empty;

    public bool IsLeading { get; set; }
}

public class PlaceBidResponse
{
    public int BidId { get; set; }

    public int ListingId { get; set; }

    public decimal BidAmount { get; set; }

    public decimal LeadingBid { get; set; }

    public DateTime BidTimestamp { get; set; }

    public string Message { get; set; } = "Bid placed successfully.";
}
