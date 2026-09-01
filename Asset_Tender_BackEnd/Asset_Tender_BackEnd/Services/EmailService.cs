using System.Net.Mail;

namespace Asset_Tender_BackEnd.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendPendingApprovalNotificationAsync(string newUserEmail, string newUserName)
    {
        var adminEmail = _config["SmtpSettings:AdminNotificationEmail"];

        if (string.IsNullOrWhiteSpace(adminEmail))
        {
            return;
        }

        var frontendUrl = _config["AppSettings:FrontendBaseUrl"] ?? "https://soit-iis.mandela.ac.za/grp-03-15/";
        var displayName = string.IsNullOrWhiteSpace(newUserName) ? newUserEmail : newUserName;

        var subject = $"[Pending Approval] New User Registration: {displayName}";
        var body = $@"
    <div style=""font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color: #333;"">
        <h2>New Registration Awaiting Approval</h2>
        <p>A new user has verified their email address and requires administrative review:</p>
        <table style=""width: 100%; border-collapse: collapse; margin: 20px 0;"">
            <tr>
                <td style=""padding: 8px 0;""><strong>Name:</strong></td>
                <td style=""padding: 8px 0;"">{displayName}</td>
            </tr>
            <tr>
                <td style=""padding: 8px 0;""><strong>Email:</strong></td>
                <td style=""padding: 8px 0;"">{newUserEmail}</td>
            </tr>
        </table>
        <p style=""margin: 30px 0;"">
            <a href=""{frontendUrl}"" 
               style=""background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;"">
                Review Account on Portal
            </a>
        </p>
        <p style=""font-size: 13px; color: #666;"">Or copy and paste this link into your browser:</p>
        <p style=""font-size: 13px;""><a href=""{frontendUrl}"">{frontendUrl}</a></p>
    </div>";

        await SendHtmlEmailAsync(adminEmail, subject, body);
    }

    public async Task SendEmailVerificationAsync(string toEmail, string verificationUrl)
    {
        await SendHtmlEmailAsync(
            toEmail,
            "Verify Your Email - Asset Tender Portal",
            $@"
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
                </div>");
    }

    public async Task SendPasswordResetAsync(string toEmail, string resetUrl)
    {
        await SendHtmlEmailAsync(
            toEmail,
            "Password Reset - Asset Tender Portal",
            $@"
                <div style=""font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color: #333;"">
                    <h2>Password Reset Request</h2>
                    <p>We received a request to reset the password for your Asset Tender Portal account.</p>
                    <p style=""margin: 30px 0;"">
                        <a href=""{resetUrl}"" 
                           style=""background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;"">
                            Reset Password
                        </a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p><a href=""{resetUrl}"">{resetUrl}</a></p>
                    <p>This link expires in 1 hour.</p>
                    <hr style=""margin-top: 30px; border: none; border-top: 1px solid #ccc;"" />
                    <p style=""font-size: 12px; color: #777;"">If you did not request a password reset, you can safely ignore this email.</p>
                </div>");
    }

    private async Task SendHtmlEmailAsync(string toEmail, string subject, string htmlBody)
    {
        var smtpServer = _config["SmtpSettings:Server"] ?? "osiris.nmmu.ac.za";
        var port = int.Parse(_config["SmtpSettings:Port"] ?? "25");
        var senderEmail = _config["SmtpSettings:SenderEmail"] ?? "noreply@mandela.ac.za";
        var senderName = _config["SmtpSettings:SenderName"] ?? "Asset Tender Portal";
        var enableSsl = bool.Parse(_config["SmtpSettings:EnableSsl"] ?? "false");

        var mailMessage = new MailMessage
        {
            From = new MailAddress(senderEmail, senderName),
            Subject = subject,
            IsBodyHtml = true,
            Body = htmlBody
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
