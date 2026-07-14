namespace Asset_Tender_BackEnd.Services;

public interface IPasswordHasherService
{
    string HashPassword(string password);
}
