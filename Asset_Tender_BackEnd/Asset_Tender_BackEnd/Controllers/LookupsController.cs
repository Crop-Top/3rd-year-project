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
                DepartmentID = d.DepartmentID,
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

        var category = new Category
        {
            CategoryName = name
        };

        _dbContext.Categories.Add(category);
        await _dbContext.SaveChangesAsync();

        return Ok(new CategoryLookupResponse
        {
            CategoryId = category.CategoryId,
            CategoryName = category.CategoryName
        });
    }
}
