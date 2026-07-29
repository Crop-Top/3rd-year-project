using System;
using System.Collections.Generic;
using Asset_Tender_BackEnd.Models.Entities;

namespace Asset_Tender_BackEnd.Models;

public partial class User
{
    public int UserId { get; set; }

    public string Username { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string? PasswordHash { get; set; }

    public int IdentityProviderId { get; set; }

    public string Role { get; set; } = null!;

    public bool IsRestricted { get; set; }

    public string? CompanyName { get; set; }

    public string AccountStatus { get; set; } = null!;

    public Guid? AdObjectGuid { get; set; }

    public string? FirstName { get; set; }

    public string? LastName { get; set; }

    public string? UserPrincipalName { get; set; }

    public string? EmployeeId { get; set; }

    public string? JobTitle { get; set; }

    public int? DepartmentID { get; set; }

    public int FailedLoginAttempt {  get; set; }

    public DateTime LockoutEnd { get; set; }

    // --- EMAIL VERIFICATION & SECURITY FIELDS ---
    public bool IsEmailVerified { get; set; } = false;

    public string? EmailVerificationToken { get; set; }

    public DateTime? EmailVerificationTokenExpiresAt { get; set; }

    public string ResetToken { get; set; } = null!;

    public DateTime ResetTokenExpiry {  get; set; }

    // --- NAVIGATION PROPERTIES ---
    public virtual ICollection<Inventory> AssetApprovedByNavigations { get; set; } = new List<Inventory>();

    public virtual ICollection<Inventory> AssetUploadedByNavigations { get; set; } = new List<Inventory>();

    public virtual ICollection<Bid> Bids { get; set; } = new List<Bid>();

    public virtual ICollection<Invoice> InvoiceBuyers { get; set; } = new List<Invoice>();

    public virtual ICollection<Invoice> InvoiceReleasedByNavigations { get; set; } = new List<Invoice>();

    public virtual ICollection<SystemDocument> SystemDocuments { get; set; } = new List<SystemDocument>();
}