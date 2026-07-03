namespace Asset_Tender_BackEnd.Services;

using System.Collections.Generic; //Temp

public interface IActiveDirectoryService
{
    bool Authenticate(string username, string password);

    Dictionary<string, List<string>> GetUserAttributes(string username, string password); //Temp
}
