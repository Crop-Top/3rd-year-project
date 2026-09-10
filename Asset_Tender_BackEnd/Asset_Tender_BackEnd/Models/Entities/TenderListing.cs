using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class TenderListing
{
    public int ListingId { get; set; }

    public int AssetId { get; set; }

    public decimal StartingBid { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public int TenderStatusId { get; set; }

    public bool IsActive { get; set; }

    public DateTime? PublishedDate { get; set; }

    public DateTime? ClosedDate { get; set; }

    public virtual Inventory Asset { get; set; } = null!;

    // --- PHASE 1: AWARD & ESCALATION FIELDS ---
    public int? AwardedUserId { get; set; }

    public DateTime? AwardedAt { get; set; }

    public DateTime? AwardDeadline { get; set; }

    public int AwardRank { get; set; } = 1;

    // --- NAVIGATION PROPERTIES ---
    public virtual User? AwardedUser { get; set; }

    public virtual TenderStatus TenderStatus { get; set; } = null!;

    public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();
}
