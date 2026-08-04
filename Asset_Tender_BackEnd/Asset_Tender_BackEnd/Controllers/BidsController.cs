using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/tenders/{listingId:int}/bids")]
[Authorize(Roles = "Staff, Bidder, Admin")]
public class BidsController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public BidsController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BidListItemResponse>>> GetBids(int listingId)
    {
        var listingExists = await TenderQueryHelper.LiveForStaff(_dbContext)
            .AnyAsync(t => t.ListingId == listingId);

        // Allow history for live lots; also allow if listing exists but recently closed
        if (!listingExists)
        {
            var anyListing = await _dbContext.TenderListings.AnyAsync(l => l.ListingId == listingId);
            if (!anyListing)
            {
                return NotFound(new { Message = "Tender listing not found." });
            }
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

    [HttpPost]
    [Authorize(Roles = "Staff, Bidder")]
    public async Task<ActionResult<PlaceBidResponse>> PlaceBid(int listingId, [FromBody] PlaceBidRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { Message = "A valid bid amount is required." });
        }

        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { Message = "Authenticated user could not be resolved. Please sign in again." });
        }

        if (user.AccountStatus != UserConstants.AccountStatusActive)
        {
            return BadRequest(new { Message = "Only active accounts can place bids." });
        }

        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var tenderStatus = await _dbContext.TenderStatuses
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenderStatusId == listing.TenderStatusId);
        var assetStatus = await _dbContext.AssetStatuses
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.AssetStatusId == listing.Asset.AssetStatusId);

        var now = DateTime.UtcNow;
        if (!listing.IsActive ||
            tenderStatus?.StatusName != UserConstants.TenderStatusOpen ||
            assetStatus?.StatusName != UserConstants.AssetStatusActive)
        {
            return BadRequest(new { Message = "This tender is not open for bidding." });
        }

        if (listing.StartTime > now)
        {
            return BadRequest(new { Message = "This auction has not started yet." });
        }

        if (listing.EndTime <= now)
        {
            return BadRequest(new { Message = "This auction has already ended." });
        }

        var amount = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero);

        var currentMax = await _dbContext.Bids
            .Where(b => b.ListingId == listingId)
            .Select(b => (decimal?)b.BidAmount)
            .MaxAsync();

        var leadingBid = currentMax ?? listing.StartingBid;
        var hasBids = currentMax.HasValue;

        if (hasBids)
        {
            if (amount <= leadingBid)
            {
                return BadRequest(new
                {
                    Message = $"Your bid must be higher than the current leading bid of {leadingBid:0.00}."
                });
            }
        }
        else if (amount < listing.StartingBid)
        {
            return BadRequest(new
            {
                Message = $"Your bid must be at least the starting bid of {listing.StartingBid:0.00}."
            });
        }

        var bid = new Bid
        {
            ListingId = listingId,
            BidderId = user.UserId,
            BidAmount = amount,
            BidTimestamp = now
        };

        _dbContext.Bids.Add(bid);
        await _dbContext.SaveChangesAsync();

        return Ok(new PlaceBidResponse
        {
            BidId = bid.BidId,
            ListingId = listingId,
            BidAmount = bid.BidAmount,
            LeadingBid = amount,
            BidTimestamp = bid.BidTimestamp,
            Message = "Bid placed successfully."
        });
    }

    private async Task<User?> ResolveCurrentUserAsync()
    {
        // Prefer a numeric user id from any nameidentifier-style claim.
        foreach (var claim in User.Claims)
        {
            var isIdClaim =
                claim.Type == ClaimTypes.NameIdentifier ||
                claim.Type == "nameid" ||
                claim.Type.EndsWith("/nameidentifier", StringComparison.OrdinalIgnoreCase);

            if (!isIdClaim)
            {
                continue;
            }

            if (int.TryParse(claim.Value, out var userId))
            {
                var byId = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                if (byId is not null)
                {
                    return byId;
                }
            }
        }

        var candidates = new List<string>();
        foreach (var claim in User.Claims)
        {
            if (claim.Type is
                    ClaimTypes.Name or
                    ClaimTypes.Email or
                    JwtRegisteredClaimNames.Sub or
                    JwtRegisteredClaimNames.UniqueName or
                    JwtRegisteredClaimNames.Email or
                    "sub" or
                    "unique_name" or
                    "email" ||
                claim.Type == ClaimTypes.NameIdentifier ||
                claim.Type.EndsWith("/nameidentifier", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(claim.Value) && !int.TryParse(claim.Value, out _))
                {
                    candidates.Add(claim.Value.Trim());
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(User.Identity?.Name))
        {
            candidates.Add(User.Identity.Name.Trim());
        }

        candidates = candidates
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var candidate in candidates)
        {
            var normalized = candidate.ToLowerInvariant();
            var user = await _dbContext.Users.FirstOrDefaultAsync(u =>
                u.Username.ToLower() == normalized ||
                u.Email.ToLower() == normalized ||
                (u.UserPrincipalName != null && u.UserPrincipalName.ToLower() == normalized));

            if (user is not null)
            {
                return user;
            }
        }

        return null;
    }
}
