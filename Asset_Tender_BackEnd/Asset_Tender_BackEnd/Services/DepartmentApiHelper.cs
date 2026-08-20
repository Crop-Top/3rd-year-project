namespace Asset_Tender_BackEnd.Services;

using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Responses;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

public static class DepartmentApiHelper
{
    private const string CacheKeyPrefix = "Dept_Name_";

    public static async Task EnrichDepartmentNamesAsync(
    List<TenderListItemResponse> items,
    IHttpClientFactory httpClientFactory)
    {
        if (items == null || items.Count == 0) return;

        var client = httpClientFactory.CreateClient();

        foreach (var item in items)
        {
            if (!item.DepartmentID.HasValue || item.DepartmentID <= 0) continue;

            try
            {
                var response = await client.GetAsync($"https://soit-sql.mandela.ac.za/api/departments/{item.DepartmentID}");
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(content);

                    if (doc.RootElement.TryGetProperty("departmentName", out var nameElement) ||
                        doc.RootElement.TryGetProperty("name", out nameElement))
                    {
                        item.DepartmentName = nameElement.GetString();
                    }
                }
            }
            catch
            {
                // Do not fall back to item.DepartmentID.ToString()
                // Leave item.DepartmentName as null if unresolvable
            }
        }
    }

    public static async Task<string?> GetDepartmentNameByCodeAsync(
    string departmentCode,
    IHttpClientFactory clientFactory,
    IMemoryCache cache)
    {
        if (string.IsNullOrWhiteSpace(departmentCode))
            return null;

        const string cacheKey = "NMU_Departments_List";

        // 1. Retrieve from cache or fetch from external API once every 24 hours
        if (!cache.TryGetValue(cacheKey, out List<NmuDepartmentDto>? departments))
        {
            try
            {
                var client = clientFactory.CreateClient();

                // Adjust casing or options if the API uses custom naming
                departments = await client.GetFromJsonAsync<List<NmuDepartmentDto>>(
                    "https://apps.mandela.ac.za/NmuGenaralThirdPartyApi/api/department/getallDepartment");

                if (departments != null && departments.Count > 0)
                {
                    var cacheOptions = new MemoryCacheEntryOptions()
                        .SetAbsoluteExpiration(TimeSpan.FromHours(24));

                    cache.Set(cacheKey, departments, cacheOptions);
                }
            }
            catch
            {
                // Logging or handling if NMU API is unreachable
                return null;
            }
        }

        // 2. Case-insensitive lookup
        var match = departments?.FirstOrDefault(d =>
            string.Equals(d.DepartmentCode?.Trim(), departmentCode.Trim(), StringComparison.OrdinalIgnoreCase));

        // 3. Return the real department name if found, otherwise null
        return match?.DepartmentName?.Trim();
    }
}