using System.Net.Mail;

namespace Asset_Tender_BackEnd.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendEmailVerificationAsync(string toEmail, string verificationUrl)
    {
        var smtpServer = _config["SmtpSettings:Server"] ?? "osiris.nmmu.ac.za";
        var port = int.Parse(_config["SmtpSettings:Port"] ?? "25");
        var senderEmail = _config["SmtpSettings:SenderEmail"] ?? "noreply@mandela.ac.za";
        var senderName = _config["SmtpSettings:SenderName"] ?? "Asset Tender Portal";
        var enableSsl = bool.Parse(_config["SmtpSettings:EnableSsl"] ?? "false");

        var mailMessage = new MailMessage
        {
            From = new MailAddress(senderEmail, senderName),
            Subject = "Verify Your Email - Asset Tender Portal",
            IsBodyHtml = true,
            Body = $@"
                <div style=""font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color: #333;"">
                    <h2>Welcome to Asset Tender Portal</h2>
                    <p>Thank you for registering. Please confirm your email address to proceed with administrative approval:</p>
                    <p style=""margin: 30px 0;"">
                        <a href=""{verificationUrl}"" 
                           style=""background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;"">
                            Verify Email Address
                        </a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p><a href=""{verificationUrl}"">{verificationUrl}</a></p>
                    <hr style=""margin-top: 30px; border: none; border-top: 1px solid #ccc;"" />
                    <p style=""font-size: 12px; color: #777;"">If you did not create this account, you can safely ignore this email.</p>
                </div>"
        };

        mailMessage.To.Add(toEmail);

        using var client = new SmtpClient(smtpServer, port)
        {
            UseDefaultCredentials = false,
            EnableSsl = enableSsl
        };

        await client.SendMailAsync(mailMessage);
    }
}