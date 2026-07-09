using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Services;

public interface IActiveDirectoryService
{
    bool Authenticate(string username, string password);

    // FIX: Ensure this accepts BOTH username and password exactly like your class does!
    Dictionary<string, List<string>> GetUserAttributes(string username, string password);
}
