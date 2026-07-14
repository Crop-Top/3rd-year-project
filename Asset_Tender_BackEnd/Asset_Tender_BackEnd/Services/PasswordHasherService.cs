using Microsoft.AspNetCore.Identity;

namespace Asset_Tender_BackEnd.Services;

public class PasswordHasherService : IPasswordHasherService
{
    private readonly PasswordHasher<object> _hasher = new();

    public string HashPassword(string password)
    {
        return _hasher.HashPassword(null!, password);
    }
}
