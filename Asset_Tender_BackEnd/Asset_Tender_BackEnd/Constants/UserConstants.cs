namespace Asset_Tender_BackEnd.Constants;

public static class UserConstants
{
    // Roles
    public const string RoleBidder = "Bidder";
    public const string RoleAdmin = "Admin";
    public const string RoleStaff = "Staff";

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
    public const string TenderStatusOpen = "Active";
    public const string TenderStatusClosed = "Closed";
    public const string TenderStatusCancelled = "Cancelled";

    // Identity Providers
    public const string IdentityProviderLocal = "Local";
    public const string IdentityProviderActiveDirectory = "ActiveDirectory";

    // Payment / PoP statuses (Invoice.PaymentStatus)
    public const string PaymentStatusPendingPop = "Pending POP";
    public const string PaymentStatusProcessing = "Processing";
    public const string PaymentStatusVerified = "Verified";
    public const string PaymentStatusRejected = "Rejected";
}