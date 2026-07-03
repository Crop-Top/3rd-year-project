using Asset_Tender_BackEnd.Models.Entities;
using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models;

public partial class User
{
    public int UserId { get; set; }

    public string Username { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string? PasswordHash { get; set; }

    public string IdentityType { get; set; } = null!;

    public string Role { get; set; } = null!;

    public bool IsRestricted { get; set; }

    public string? CompanyName { get; set; }

    public string AccountStatus { get; set; } = null!;

    public string? ProfilePhotoUrl { get; set; }

    public virtual ICollection<Asset> AssetApprovedByNavigations { get; set; } = new List<Asset>();

    public virtual ICollection<Asset> AssetUploadedByNavigations { get; set; } = new List<Asset>();

    public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();

    public virtual ICollection<Invoice> InvoiceBuyers { get; set; } = new List<Invoice>();

    public virtual ICollection<Invoice> InvoiceReleasedByNavigations { get; set; } = new List<Invoice>();

    public virtual ICollection<SystemDocument> SystemDocuments { get; set; } = new List<SystemDocument>();
}
