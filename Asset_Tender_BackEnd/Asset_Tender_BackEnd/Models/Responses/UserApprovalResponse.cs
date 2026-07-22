namespace Asset_Tender_BackEnd.Models.Responses;

public class UserApprovalResponse
{
    public int UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public string AccountStatus { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;
}
