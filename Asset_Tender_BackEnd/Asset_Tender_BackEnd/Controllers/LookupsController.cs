using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Models.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Text.RegularExpressions;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/Lookups")]
public class LookupsController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly NmuApiSettings _nmuApiSettings;

    // Inject both DBContext, HttpClientFactory, and your NmuApiSettings
    public LookupsController(
        Asset_Tender_DBContext dbContext,
        IHttpClientFactory httpClientFactory,
        IOptions<NmuApiSettings> nmuApiOptions)
    {
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
        _nmuApiSettings = nmuApiOptions.Value;
    }

    [HttpGet("categories")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<CategoryLookupResponse>>> GetCategories()
    {
        var categories = await _dbContext.Categories
            .OrderBy(c => c.CategoryName)
            .Select(c => new CategoryLookupResponse
            {
                CategoryId = c.CategoryId,
                CategoryName = c.CategoryName
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var client = _httpClientFactory.CreateClient();

        // Construct full URL using appsettings BaseUrl
        var baseUrl = string.IsNullOrWhiteSpace(_nmuApiSettings.BaseUrl)
            ? "https://apps.mandela.ac.za/NmuGenaralThirdPartyApi/"
            : _nmuApiSettings.BaseUrl;

        var endpointUrl = $"{baseUrl.TrimEnd('/')}/api/department/getallDepartment";

        var request = new HttpRequestMessage(HttpMethod.Get, endpointUrl);

        // Inject headers dynamically
        request.Headers.Add("accept", "*/*");
        request.Headers.Add("ApiKey", _nmuApiSettings.ApiKey);

        try
        {
            var response = await client.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, "Failed to retrieve departments from external API.");
            }

            var jsonContent = await response.Content.ReadAsStringAsync();

            // Return the raw JSON straight to your React frontend
            return Content(jsonContent, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpPost("categories")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<CategoryLookupResponse>> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        var name = request.CategoryName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { Message = "Category name is required." });
        }

        var exists = await _dbContext.Categories
            .AnyAsync(c => c.CategoryName.ToLower() == name.ToLower());

        if (exists)
        {
            return Conflict(new { Message = "That category already exists." });
        }

        var maxOrder = await _dbContext.Categories
            .MaxAsync(c => (int?)c.DisplayOrder) ?? 0;

        var categoryCode = await GenerateUniqueCategoryCodeAsync(name);

        var category = new Category
        {
            CategoryName = name,
            CategoryCode = categoryCode,
            Description = string.Empty,
            DisplayOrder = maxOrder + 1,
            IsActive = 1,
            CreatedDate = DateTime.UtcNow,
            ParentCategoryID = null
        };

        _dbContext.Categories.Add(category);

        try
        {
            await _dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            return BadRequest(new { Message = ex.InnerException?.Message ?? ex.Message });
        }

        return Ok(new CategoryLookupResponse
        {
            CategoryId = category.CategoryId,
            CategoryName = category.CategoryName
        });
    }

    private static string GenerateCategoryCode(string name)
    {
        var slug = Regex.Replace(name.ToUpperInvariant(), @"[^A-Z0-9]+", "_").Trim('_');
        if (string.IsNullOrEmpty(slug))
        {
            slug = "CATEGORY";
        }

        return slug.Length <= 50 ? slug : slug[..50];
    }

    private async Task<string> GenerateUniqueCategoryCodeAsync(string name)
    {
        var baseCode = GenerateCategoryCode(name);
        var code = baseCode;
        var suffix = 1;

        while (await _dbContext.Categories.AnyAsync(c => c.CategoryCode == code))
        {
            var suffixText = $"_{suffix}";
            var maxBaseLength = 50 - suffixText.Length;
            code = $"{baseCode[..Math.Min(baseCode.Length, maxBaseLength)]}{suffixText}";
            suffix++;
        }

        return code;
    }
}