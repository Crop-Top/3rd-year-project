namespace Asset_Tender_BackEnd.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendEmailVerificationAsync(string toEmail, string verificationUrl)
        {
            // Example using System.Net.Mail or MailKit
            var smtpHost = _config["EmailSettings:Host"];
            var smtpPort = int.Parse(_config["EmailSettings:Port"] ?? "587");
            var senderEmail = _config["EmailSettings:SenderEmail"];
            var senderPassword = _config["EmailSettings:Password"];

            using var client = new System.Net.Mail.SmtpClient(smtpHost, smtpPort)
            {
                Credentials = new System.Net.NetworkCredential(senderEmail, senderPassword),
                EnableSsl = true
            };

            var mailMessage = new System.Net.Mail.MailMessage
            {
                From = new System.Net.Mail.MailAddress(senderEmail!, "Asset Tender Portal"),
                Subject = "Verify Your Email Address - Asset Tender Portal",
                Body = $@"
                <h2>Welcome to Asset Tender Portal</h2>
                <p>Please click the link below to verify your email address:</p>
                <p><a href='{verificationUrl}'>Verify Email Address</a></p>
                <br/>
                <p>Once verified, an administrator will review your application.</p>",
                IsBodyHtml = true
            };

            mailMessage.To.Add(toEmail);
            await client.SendMailAsync(mailMessage);
        }
    }
}
