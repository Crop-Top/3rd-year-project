using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

/// <summary>
/// Bid history for a tender listing (Admin / SuperAdmin only — sealed offers).
/// Place-offer lives on WinningBidsController (POST /api/bids/PlaceBid).
/// </summary>
[ApiController]
[Route("api/tenders/{listingId:int}/bids")]
[Authorize(Roles = "Admin, SuperAdmin")]
public class ListingBidsController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public ListingBidsController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BidListItemResponse>>> GetBids(int listingId)
    {
        var listingExists = await _dbContext.TenderListings
            .AnyAsync(l => l.ListingId == listingId);

        if (!listingExists)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var bids = await _dbContext.Bids
            .AsNoTracking()
            .Where(b => b.ListingId == listingId)
            .OrderByDescending(b => b.BidAmount)
            .ThenByDescending(b => b.BidTimestamp)
            .Select(b => new BidListItemResponse
            {
                BidId = b.BidId,
                ListingId = b.ListingId,
                BidAmount = b.BidAmount,
                BidTimestamp = b.BidTimestamp,
                BidderId = b.BidderId,
                BidderDisplayName = b.Bidder.CompanyName ?? b.Bidder.FullName ?? b.Bidder.Username
            })
            .ToListAsync();

        if (bids.Count > 0)
        {
            var leadingAmount = bids[0].BidAmount;
            foreach (var bid in bids)
            {
                bid.IsLeading = bid.BidAmount == leadingAmount;
            }
        }

        return Ok(bids);
    }
}
