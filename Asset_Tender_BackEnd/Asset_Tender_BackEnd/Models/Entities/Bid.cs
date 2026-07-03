using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class Bid
{
    public int BidId { get; set; }

    public int ListingId { get; set; }

    public int BidderId { get; set; }

    public decimal BidAmount { get; set; }

    public DateTime BidTimestamp { get; set; }

    public virtual User Bidder { get; set; } = null!;

    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();

    public virtual TenderListing Listing { get; set; } = null!;
}
