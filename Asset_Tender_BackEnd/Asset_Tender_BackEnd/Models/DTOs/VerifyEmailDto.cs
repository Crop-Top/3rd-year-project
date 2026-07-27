namespace Asset_Tender_BackEnd.Models.DTOs;

public class VerifyEmailDto
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
}