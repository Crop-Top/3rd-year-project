using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class Inventory
{
    public int AssetId { get; set; }

    public string AssetName { get; set; } = null!;

    public string? BarcodeSerial { get; set; }

    public int CategoryId { get; set; }

    public int DepartmentID { get; set; }

    public string? CostCenter { get; set; }

    public string? Location { get; set; }

    public string? AssetDescription { get; set; }

    public int AssetConditionId { get; set; }

    public string? ConditionNotes { get; set; }

    public string? ImageUrl { get; set; }

    public decimal ReccomendedPrice { get; set; }

    public int AssetStatusId { get; set; }

    public int UploadedBy { get; set; }

    public int? ApprovedBy { get; set; }

    public virtual User? ApprovedByNavigation { get; set; }

    public virtual Category Category { get; set; } = null!;

    public virtual Department Department { get; set; } = null!;

    public virtual ICollection<TenderListing> TenderListings { get; set; } = new List<TenderListing>();

    public virtual AssetImage? AssetImage { get; set; }

    public virtual User UploadedByNavigation { get; set; } = null!;
}
