using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models;

public partial class TenderListing
{
    public int ListingId { get; set; }

    public int AssetId { get; set; }

    public decimal StartingBid { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public bool IsActive { get; set; }

    public virtual Asset Asset { get; set; } = null!;

    public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();
}
