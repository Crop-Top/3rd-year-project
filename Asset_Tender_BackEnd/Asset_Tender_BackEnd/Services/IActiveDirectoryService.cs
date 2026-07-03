namespace Asset_Tender_BackEnd.Services;

public interface IActiveDirectoryService
{
    bool Authenticate(string username, string password);
}
