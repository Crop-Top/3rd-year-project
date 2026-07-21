using Microsoft.AspNetCore.Identity;

namespace Asset_Tender_BackEnd.Services;

public interface IPasswordHasherService
{
    string HashPassword(string password);
    bool VerifyPassword(string hashedPassword, string providedPassword);
}