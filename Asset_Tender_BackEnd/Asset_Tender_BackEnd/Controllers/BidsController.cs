using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/bids")]
[Authorize(Roles = "Staff, Bidder, Admin")]
public class WinningBidsController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public WinningBidsController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Retrieves winning bids (leading bid on ended listings) for the authenticated user.
    /// GET /api/bids/winning
    /// </summary>
    [HttpGet("winning")]
    public async Task<IActionResult> GetWinningBids()
    {
        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { Message = "Authenticated user could not be resolved. Please sign in again." });
        }

        var now = DateTime.Now;

        var candidateBidsQuery = _dbContext.Bids
            .AsNoTracking()
            .Include(b => b.Listing)
                .ThenInclude(l => l.Asset!)
            .Where(b => b.BidderId == user.UserId)
            .Where(b => !b.Listing.IsActive || b.Listing.EndTime <= now);

        if (CategoryAccessHelper.IsBidderRole(user.Role))
        {
            var vehicleAssetIds = await _dbContext.Assets
                .AsNoTracking()
                .Where(a => a.Category.CategoryName.ToLower() ==
                    CategoryAccessHelper.VehiclesCategoryName.ToLower())
                .Select(a => a.AssetId)
                .ToListAsync();

            candidateBidsQuery = candidateBidsQuery.Where(b =>
                b.Listing.Asset != null && vehicleAssetIds.Contains(b.Listing.Asset.AssetId));
        }

        var candidateBids = await candidateBidsQuery
            .OrderByDescending(b => b.Listing.EndTime)
            .ToListAsync();

        var listingIds = candidateBids.Select(b => b.ListingId).Distinct().ToList();
        var leadingRows = await _dbContext.Bids
            .AsNoTracking()
            .Where(b => listingIds.Contains(b.ListingId))
            .GroupBy(b => b.ListingId)
            .Select(g => new { ListingId = g.Key, MaxAmount = g.Max(x => x.BidAmount) })
            .ToListAsync();
        var leadingByListing = leadingRows.ToDictionary(x => x.ListingId, x => x.MaxAmount);

        var winningBids = candidateBids
            .Where(b => leadingByListing.TryGetValue(b.ListingId, out var max) && b.BidAmount == max)
            .GroupBy(b => b.ListingId)
            .Select(g => g.OrderByDescending(b => b.BidTimestamp).First())
            .ToList();

        var userWinningBids = winningBids.Select(b => new
        {
            id = b.BidId,
            listingId = b.ListingId,
            title = b.Listing.Asset?.AssetName ?? "Asset Tender Lot",
            serial = string.IsNullOrWhiteSpace(b.Listing.Asset?.BarcodeSerial)
                ? "N/A"
                : b.Listing.Asset!.BarcodeSerial,
            wonDate = b.Listing.EndTime.ToString("dd MMM yyyy"),
            image = b.Listing.Asset?.ImageUrl,
            amount = b.BidAmount
        }).ToList();

        return Ok(userWinningBids);
    }

    /// <summary>
    /// Places a single sealed offer on a tender listing.
    /// POST /api/bids/PlaceBid
    /// </summary>
    [HttpPost("PlaceBid")]
    public async Task<IActionResult> PlaceBid([FromBody] PlaceBidDto request)
    {
        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { message = "User identity not found or invalid token." });
        }

        if (!string.Equals(user.AccountStatus, UserConstants.AccountStatusActive, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Your account must be active to place an offer." });
        }

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Offer amount must be greater than zero." });
        }

        var now = DateTime.Now;

        // Project only needed columns — full Include(Category) fails when
        // CategoryCode/Description/CreatedDate are NULL in Assets.Categories.
        var listingInfo = await (
            from l in _dbContext.TenderListings.AsNoTracking()
            join a in _dbContext.Assets.AsNoTracking() on l.AssetId equals a.AssetId
            join c in _dbContext.Categories.AsNoTracking() on a.CategoryId equals c.CategoryId
            where l.ListingId == request.TenderId
            select new
            {
                l.ListingId,
                l.IsActive,
                l.StartingBid,
                l.StartTime,
                l.EndTime,
                l.TenderStatusId,
                a.AssetStatusId,
                CategoryName = c.CategoryName
            }
        ).FirstOrDefaultAsync();

        if (listingInfo is null)
        {
            return NotFound(new { message = "Tender listing not found." });
        }

        var assetStatusName = await _dbContext.AssetStatuses
            .AsNoTracking()
            .Where(s => s.AssetStatusId == listingInfo.AssetStatusId)
            .Select(s => s.StatusName)
            .FirstOrDefaultAsync();

        var tenderStatusName = await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.TenderStatusId == listingInfo.TenderStatusId)
            .Select(s => s.StatusName)
            .FirstOrDefaultAsync();

        if (!listingInfo.IsActive ||
            !string.Equals(tenderStatusName, UserConstants.TenderStatusOpen, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(assetStatusName, UserConstants.AssetStatusActive, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "This tender is not open for offers." });
        }

        // 1. Tender has not started yet (StartTime is in the future)
        if (listingInfo.StartTime > now)
        {
            return BadRequest(new { message = "This tender has not started yet." });
        }

        // 2. Tender has already closed (EndTime is in the past)
        if (listingInfo.EndTime <= now)
        {
            return BadRequest(new { message = "This tender has already closed." });
        }

        if (CategoryAccessHelper.IsBidderRole(user.Role) &&
            !CategoryAccessHelper.IsVehiclesCategory(listingInfo.CategoryName))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "External bidders may only place offers on Vehicles lots."
            });
        }

        var alreadyOffered = await _dbContext.Bids
            .AnyAsync(b => b.ListingId == listingInfo.ListingId && b.BidderId == user.UserId);

        if (alreadyOffered)
        {
            return Conflict(new { message = "You have already submitted an offer on this lot." });
        }

        _dbContext.Bids.Add(new Bid
        {
            ListingId = listingInfo.ListingId,
            BidderId = user.UserId,
            BidAmount = request.Amount,
            BidTimestamp = now
        });

        try
        {
            await _dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "You have already submitted an offer on this lot." });
        }

        return Ok(new { message = "Offer submitted successfully." });
    }

    [HttpGet("my-active")]
    public async Task<IActionResult> GetMyActiveBids()
    {
        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { Message = "Invalid user identity or missing token claims." });
        }

        var now = DateTime.UtcNow;

        var activeBidsQuery =
            from b in _dbContext.Bids.AsNoTracking()
            join l in _dbContext.TenderListings.AsNoTracking() on b.ListingId equals l.ListingId
            join a in _dbContext.Assets.AsNoTracking() on l.AssetId equals a.AssetId into assetJoin
            from a in assetJoin.DefaultIfEmpty()
            join c in _dbContext.Categories.AsNoTracking() on a.CategoryId equals c.CategoryId into catJoin
            from c in catJoin.DefaultIfEmpty()
            where l.IsActive && l.EndTime > now && b.BidderId == user.UserId
            select new
            {
                l.ListingId,
                l.EndTime,
                AssetName = a != null ? a.AssetName : null,
                AssetDescription = a != null ? a.AssetDescription : null,
                CategoryName = c != null ? c.CategoryName : "TENDER LOT",
                ImageUrl = a != null ? a.ImageUrl : null,
                BidAmount = b.BidAmount
            };

        if (CategoryAccessHelper.IsBidderRole(user.Role))
        {
            var vehicles = CategoryAccessHelper.VehiclesCategoryName.ToLower();
            activeBidsQuery = activeBidsQuery.Where(x =>
                x.CategoryName != null && x.CategoryName.ToLower() == vehicles);
        }

        var grouped = await activeBidsQuery
            .GroupBy(x => new
            {
                x.ListingId,
                x.EndTime,
                x.AssetName,
                x.AssetDescription,
                x.CategoryName,
                x.ImageUrl
            })
            .Select(g => new
            {
                g.Key.ListingId,
                Title = g.Key.AssetName ?? $"Lot #{g.Key.ListingId}",
                Category = g.Key.CategoryName,
                Description = g.Key.AssetDescription ?? "Active tender asset lot.",
                MyOfferAmount = g.Max(x => x.BidAmount),
                EndTime = g.Key.EndTime,
                Image = g.Key.ImageUrl
            })
            .ToListAsync();

        var result = grouped.Select(x => new
        {
            id = x.ListingId.ToString(),
            listingId = x.ListingId.ToString(),
            title = x.Title,
            category = x.Category,
            description = x.Description,
            myBid = x.MyOfferAmount,
            myOfferAmount = x.MyOfferAmount,
            hasSubmittedOffer = true,
            leadingBid = (decimal?)null,
            isWinning = (bool?)null,
            closesInHours = Math.Max(0, (int)Math.Ceiling((x.EndTime - now).TotalHours)),
            offerEndsAt = x.EndTime, // <--- ADD THIS PROPERTY
            image = x.Image
        });

        return Ok(result);
    }

    /// <summary>
    /// Helper method to resolve the current User entity from JWT token claims.
    /// </summary>
    private async Task<User?> ResolveCurrentUserAsync()
    {
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
            var found = await _dbContext.Users.FirstOrDefaultAsync(u =>
                u.Username.ToLower() == normalized ||
                u.Email.ToLower() == normalized ||
                (u.UserPrincipalName != null && u.UserPrincipalName.ToLower() == normalized));

            if (found is not null)
            {
                return found;
            }
        }

        return null;
    }
}
