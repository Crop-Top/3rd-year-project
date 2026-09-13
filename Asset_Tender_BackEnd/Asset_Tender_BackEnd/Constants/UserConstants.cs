namespace Asset_Tender_BackEnd.Constants;

public static class UserConstants
{
    // Roles
    public const string RoleBidder = "Bidder";
    public const string RoleAdmin = "Admin";
    public const string RoleStaff = "Staff";
    public const string RoleSuperAdmin = "SuperAdmin";

    // User Account Statuses
    public const string AccountStatusEmailUnverified = "EmailUnverified"; // Added for pre-approval verification
    public const string AccountStatusPending = "Pending";
    public const string AccountStatusActive = "Active";
    public const string AccountStatusRejected = "Rejected";
    public const string AccountStatusSuspended = "Suspended";

    // Asset Statuses
    public const string AssetStatusPending = "Pending";
    public const string AssetStatusActive = "Active";
    public const string AssetStatusRejected = "Rejected";
    public const string AssetStatusDonation = "Donation";
    public const string AssetStatusScrap = "Scrap";

    // Tender Statuses
    public const string TenderStatusPending = "Pending";
    public const string TenderStatusOpen = "Open";
    /// <summary>Campus lookup also uses "Active" for live listings (instead of Open).</summary>
    public const string TenderStatusActive = "Active";
    public const string TenderStatusClosed = "Closed";
    /// <summary>Campus lookup for sold/won lots (instead of / alongside Closed).</summary>
    public const string TenderStatusAwarded = "Awarded";
    /// <summary>Campus SP sets unsold past-end lots to Expired (historically TenderStatusId = 6).</summary>
    public const string TenderStatusExpired = "Expired";
    public const string TenderStatusCancelled = "Cancelled";
    public const string TenderStatusRejected = "Rejected";

    // Identity Providers
    public const string IdentityProviderLocal = "Local";
    public const string IdentityProviderActiveDirectory = "ActiveDirectory";

    // Payment / PoP statuses (Invoice.PaymentStatus)
    public const string PaymentStatusPendingPop = "Pending POP";
    public const string PaymentStatusProcessing = "Processing";
    public const string PaymentStatusVerified = "Verified";
    public const string PaymentStatusRejected = "Rejected";
}