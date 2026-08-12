using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data;
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

        var now = DateTime.UtcNow;

        var candidateBids = await _dbContext.Bids
            .AsNoTracking()
            .Include(b => b.Listing)
                .ThenInclude(l => l.Asset)
            .Where(b => b.BidderId == user.UserId)
            .Where(b => !b.Listing.IsActive || b.Listing.EndTime <= now)
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
    /// Places a bid on a tender listing via the sp_PlaceBid stored procedure.
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

        try
        {
            // Reuses the active database connection configured in EF Core
            var connection = (SqlConnection)_dbContext.Database.GetDbConnection();

            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            using var command = new SqlCommand("Tender.sp_PlaceBid", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.AddWithValue("@TenderId", request.TenderId);
            command.Parameters.AddWithValue("@UserId", user.UserId);
            command.Parameters.AddWithValue("@Amount", request.Amount);

            // Output parameter for error messages from SP
            var errorMessageParam = new SqlParameter("@ErrorMessage", SqlDbType.NVarChar, 255)
            {
                Direction = ParameterDirection.Output
            };
            command.Parameters.Add(errorMessageParam);

            await command.ExecuteNonQueryAsync();

            string? errorMessage = errorMessageParam.Value as string;
            if (!string.IsNullOrEmpty(errorMessage))
            {
                return BadRequest(new { message = errorMessage });
            }

            return Ok(new { message = "Bid placed successfully!" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Database error: " + ex.Message });
        }
    }

    [HttpGet("my-active")]
    public async Task<IActionResult> GetMyActiveBids()
    {
        // Check multiple claim types to ensure the User ID is found
        var userIdClaim = User.FindFirst("UserId")?.Value
            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("id")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
        {
            return Unauthorized(new { Message = "Invalid user identity or missing token claims." });
        }

        var now = DateTime.Now;

        var activeBids = await (
            from b in _dbContext.Bids
            join l in _dbContext.TenderListings on b.ListingId equals l.ListingId
            join a in _dbContext.Assets on l.AssetId equals a.AssetId into assetJoin
            from a in assetJoin.DefaultIfEmpty()
            where l.IsActive && l.EndTime > now && b.BidderId == currentUserId
            group b by new
            {
                l.ListingId,
                l.EndTime,
                AssetName = a != null ? a.AssetName : null,
                AssetDescription = a != null ? a.AssetDescription : null,
                CategoryName = a != null && a.Category != null ? a.Category.CategoryName : "TENDER LOT",
                ImageUrl = a != null ? a.ImageUrl : null
            } into g
            select new
            {
                ListingId = g.Key.ListingId,
                Title = g.Key.AssetName ?? $"Lot #{g.Key.ListingId}",
                Category = g.Key.CategoryName,
                Description = g.Key.AssetDescription ?? "Active tender asset lot.",
                MyBid = g.Max(b => b.BidAmount),
                LeadingBid = _dbContext.Bids
                    .Where(b2 => b2.ListingId == g.Key.ListingId)
                    .Max(b2 => (decimal?)b2.BidAmount) ?? 0,
                EndTime = g.Key.EndTime,
                Image = g.Key.ImageUrl
            }
        ).ToListAsync();

        var result = activeBids.Select(x => new
        {
            id = x.ListingId.ToString(),
            listingId = x.ListingId.ToString(),
            title = x.Title,
            category = x.Category,
            description = x.Description,
            myBid = x.MyBid,
            leadingBid = x.LeadingBid,
            isWinning = x.MyBid >= x.LeadingBid,
            closesInHours = Math.Max(0, (int)Math.Ceiling((x.EndTime - now).TotalHours)),
            image = x.Image
        });

        return Ok(result);
    }


    /// <summary>
    /// Helper method to resolve the current User entity from JWT token claims.
    /// </summary>
    private async Task<User?> ResolveCurrentUserAsync()
    {
        // 1. Prefer numeric user ID from claim types
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

        // 2. Candidate strings (username, email, or principal name)
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