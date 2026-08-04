using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/tenders")]
[Authorize(Roles = "Staff, Bidder, Admin")]
public class TendersController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public TendersController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TenderListItemResponse>>> GetLiveTenders()
    {
        var tenders = await TenderQueryHelper.LiveForStaff(_dbContext)
            .OrderBy(t => t.EndTime)
            .ToListAsync();

        return Ok(tenders);
    }

    [HttpGet("{listingId:int}")]
    public async Task<ActionResult<TenderListItemResponse>> GetLiveTender(int listingId)
    {
        var tender = await TenderQueryHelper.LiveForStaff(_dbContext)
            .FirstOrDefaultAsync(t => t.ListingId == listingId);

        if (tender is null)
        {
            return NotFound(new { Message = "Tender not found or not available." });
        }

        return Ok(tender);
    }
}
