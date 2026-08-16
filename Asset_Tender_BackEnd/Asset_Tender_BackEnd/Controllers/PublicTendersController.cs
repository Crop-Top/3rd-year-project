using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/public/tenders")]
[AllowAnonymous]
public class PublicTendersController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public PublicTendersController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Public read-only list of live Open/Active tenders for the landing page.
    /// Optional limit (e.g. featured = 3 closing soonest).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TenderListItemResponse>>> GetLiveTenders([FromQuery] int? limit)
    {
        IQueryable<TenderListItemResponse> query = TenderQueryHelper.LiveForStaff(_dbContext)
            .OrderBy(t => t.EndTime);

        if (limit is > 0)
        {
            query = query.Take(limit.Value);
        }

        var tenders = await query.ToListAsync();

        await TenderQueryHelper.ApplyViewerOfferAndSealAsync(
            _dbContext,
            tenders,
            viewerUserId: null,
            revealCompetitiveBids: false);

        return Ok(tenders);
    }
}
