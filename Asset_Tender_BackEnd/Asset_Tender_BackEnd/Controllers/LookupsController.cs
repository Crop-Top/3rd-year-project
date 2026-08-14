using System.Text.RegularExpressions;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/Lookups")]
public class LookupsController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public LookupsController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
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
    [Authorize]
    public async Task<ActionResult<IEnumerable<DepartmentLookupResponse>>> GetDepartments()
    {
        var departments = await _dbContext.Departments
            .OrderBy(d => d.DepartmentName)
            .Select(d => new DepartmentLookupResponse
            {
                DepartmentId = d.DepartmentID,
                DepartmentName = d.DepartmentName
            })
            .ToListAsync();

        return Ok(departments);
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
