namespace Asset_Tender_BackEnd.Services
{
    public interface IEmailService
    {
        Task SendEmailVerificationAsync(string toEmail, string verificationUrl);
        Task SendPasswordResetAsync(string toEmail, string resetUrl);
        Task SendPendingApprovalNotificationAsync(string newUserEmail, string newUserName);
        Task SendTenderCancelledNotificationAsync(string bidderEmail, string bidderName, string tenderTitle, string tenderReference, string reason);
        Task SendAwardEscalationNotificationAsync(string bidderEmail, int listingId, decimal bidAmount);
    }
}
