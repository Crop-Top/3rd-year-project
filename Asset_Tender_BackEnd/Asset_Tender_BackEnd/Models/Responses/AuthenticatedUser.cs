namespace Asset_Tender_BackEnd.Models.Responses;

public class AuthenticatedUser
{
    public bool Authenticated { get; set; }

    public string Username { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    public string EmployeeId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
}
