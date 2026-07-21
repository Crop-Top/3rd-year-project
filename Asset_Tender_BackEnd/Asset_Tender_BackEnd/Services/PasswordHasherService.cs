using Microsoft.AspNetCore.Identity;

namespace Asset_Tender_BackEnd.Services;

public class PasswordHasherService : IPasswordHasherService
{
    private readonly PasswordHasher<string> _hasher = new();

    public string HashPassword(string password)
    {
        // Uses PBKDF2 with HMAC-SHA256, 128-bit salt, 256-bit subkey
        return _hasher.HashPassword("user", password);
    }

    public bool VerifyPassword(string hashedPassword, string providedPassword)
    {
        var result = _hasher.VerifyHashedPassword("user", hashedPassword, providedPassword);
        return result != PasswordVerificationResult.Failed;
    }
}
