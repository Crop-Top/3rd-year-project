using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class TenderStatus
{
    public int TenderStatusId { get; set; }

    public string StatusName { get; set; } = null!;

    public string? Description { get; set; }

    public int DisplayOrder { get; set; }

    // Navigation property:
    public virtual ICollection<TenderListing> TenderListings { get; set; } = new List<TenderListing>();
}

public static class TenderStatuses
{
    public const int Pending = 1;
    public const int Active = 2;
    public const int Rejected = 3;
    public const int Donation = 4;
    public const int Scrap = 5;
    public const int Expired = 6;
    public const int Cancelled = 7;
    public const int Awarded = 8;
    public const int Collected = 9;
    public const int Defaulted = 10;
}