using System.DirectoryServices.AccountManagement;
using Microsoft.Extensions.Options;
using Asset_Tender_BackEnd.Configuration;

namespace Asset_Tender_BackEnd.Services;

public class ActiveDirectoryService : IActiveDirectoryService
{
    private readonly ActiveDirectorySettings _settings;

    public ActiveDirectoryService(IOptions<ActiveDirectorySettings> options)
    {
        _settings = options.Value;
    }

    public bool Authenticate(string username, string password)
    {
        try
        {
            using var context = new PrincipalContext(
                ContextType.Domain,
                _settings.Domain);

            bool valid = context.ValidateCredentials(
                username,
                password,
                ContextOptions.Negotiate);

            return valid;
        }
        catch (Exception ex)
        {
            Console.WriteLine("AD ERROR:");
            Console.WriteLine(ex.Message);

            return false;
        }
    }
}