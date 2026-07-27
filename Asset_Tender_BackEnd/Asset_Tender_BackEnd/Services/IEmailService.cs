namespace Asset_Tender_BackEnd.Services
{
    public interface IEmailService
    {
        Task SendEmailVerificationAsync(string toEmail, string verificationUrl);
    }
}
