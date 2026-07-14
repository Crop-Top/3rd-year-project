// Models/DTOs/UserDto.cs
namespace Asset_Tender_BackEnd.Models.DTOs;

public class UserDto
{
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
