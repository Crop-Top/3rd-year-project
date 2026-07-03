using System.DirectoryServices.AccountManagement;
using Microsoft.Extensions.Options;
using Asset_Tender_BackEnd.Configuration;

using System.DirectoryServices; //Temp
using System.DirectoryServices.AccountManagement; //Temp

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

    public Dictionary<string, List<string>> GetUserAttributes(string username, string password) //Temp
    {
        var attributes = new Dictionary<string, List<string>>();

        using var entry = new DirectoryEntry(
            _settings.LdapPath,
            username,
            password);

        using var searcher = new DirectorySearcher(entry);

        searcher.Filter = $"(userPrincipalName={username})";

        SearchResult? result = searcher.FindOne();

        if (result == null)
        {
            return attributes;
        }

        foreach (string propertyName in result.Properties.PropertyNames)
        {
            var values = new List<string>();

            foreach (var value in result.Properties[propertyName])
            {
                values.Add(value?.ToString() ?? "");
            }

            attributes[propertyName] = values;
        }

        return attributes;
    }
}