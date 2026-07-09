// Models/Requests/LoginModels.cs
using Asset_Tender_BackEnd.Models.DTOs;

namespace Asset_Tender_BackEnd.Models.Requests;

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public UserDto User { get; set; } = new();
}