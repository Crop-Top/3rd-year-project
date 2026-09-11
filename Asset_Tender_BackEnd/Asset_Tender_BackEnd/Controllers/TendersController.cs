using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/tenders")]
[Authorize(Roles = "Staff, Bidder, Admin, SuperAdmin")]
public class TendersController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IEmailService _emailService;
    private readonly ILogger<TendersController> _logger;

    private readonly IBusinessDaysService _businessDaysService;

    public TendersController(
        Asset_Tender_DBContext dbContext,
        IEmailService emailService,
        ILogger<TendersController> logger,
        IBusinessDaysService businessDaysService)
    {
        _dbContext = dbContext;
        _emailService = emailService;
        _logger = logger;
        _businessDaysService = businessDaysService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TenderListItemResponse>>> GetLiveTenders()
    {
        var user = await ResolveCurrentUserAsync();
        var role = user?.Role ?? User.FindFirst(ClaimTypes.Role)?.Value;

        var query = TenderQueryHelper.ForBidderVisibility(
            TenderQueryHelper.LiveForStaff(_dbContext),
            role);

        var tenders = await query
            .OrderBy(t => t.EndTime)
            .ToListAsync();

        await TenderQueryHelper.ApplyViewerOfferAndSealAsync(
            _dbContext,
            tenders,
            user?.UserId,
            CategoryAccessHelper.CanRevealCompetitiveBids(role));

        return Ok(tenders);
    }

    /// <summary>
    /// Marks a tender as collected and resets winner's consecutive defaults.
    /// POST /api/assets/{id}/mark-collected
    /// </summary>
    [HttpPost("{id:int}/mark-collected")]
    public async Task<IActionResult> MarkAsCollected(int id)
    {
        var listing = await _dbContext.Set<TenderListing>()
            .Include(t => t.AwardedUser)
            .FirstOrDefaultAsync(t => t.ListingId == id);

        if (listing == null)
            return NotFound("Tender listing not found.");

        if (listing.TenderStatusId != TenderStatuses.Awarded)
            return BadRequest("Listing must be in 'Awarded' status to be marked as collected.");

        // Update listing status
        listing.TenderStatusId = TenderStatuses.Collected;
        listing.ClosedDate = DateTime.UtcNow;

        // Reset winner's consecutive defaults on successful transaction
        if (listing.AwardedUser != null)
        {
            listing.AwardedUser.ConsecutiveDefaults = 0;
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { Message = "Asset successfully marked as collected. Winner default counter reset to 0." });
    }

    /// <summary>
    /// Processes default for non-responsive winner and escalates to the next highest bidder.
    /// POST /api/tenders/{id}/process-default
    /// </summary>
    [HttpPost("{id:int}/process-default")]
    [Authorize(Roles = "Admin, SuperAdmin")]
    public async Task<IActionResult> ProcessDefault(int id)
    {
        var listing = await _dbContext.TenderListings
            .Include(t => t.AwardedUser)
            .FirstOrDefaultAsync(t => t.ListingId == id);

        if (listing == null)
            return NotFound("Tender listing not found.");

        if (listing.TenderStatusId != TenderStatuses.Awarded)
            return BadRequest("Only awarded listings can be defaulted.");

        // 1. Penalize defaulting user
        if (listing.AwardedUser != null)
        {
            var user = listing.AwardedUser;
            user.ConsecutiveDefaults += 1;

            switch (user.ConsecutiveDefaults)
            {
                case 1:
                    user.IsSuspended = true;
                    user.SuspendedUntil = DateTime.UtcNow.AddMinutes(5);//TODO make into 3 months
                    user.BanReason = "Defaulted on tender award (1st offense - 3-month suspension).";
                    break;

                case 2:
                    user.IsSuspended = true;
                    user.SuspendedUntil = DateTime.UtcNow.AddMonths(6);//TODO make into 6 months
                    user.BanReason = "Defaulted on tender award (2nd offense - 6-month suspension).";
                    break;

                default: // 3 or more defaults
                    user.IsPermanentlyBanned = true;
                    user.IsSuspended = false;
                    user.SuspendedUntil = null;
                    user.BanReason = "Defaulted on tender award 3 times. Account permanently banned.";
                    break;
            }
        }

        // 2. Mark current offer state as Defaulted
        listing.TenderStatusId = TenderStatuses.Defaulted;

        // 3. Find next highest valid bidder
        int nextRank = listing.AwardRank + 1;
        int? defaultedUserId = listing.AwardedUserId;

        // Updated query mapping: BidderId and BidTimestamp
        var nextBid = await _dbContext.Bids
            .Include(b => b.Bidder)
            .Where(b => b.ListingId == id
                     && b.BidderId != defaultedUserId
                     && !b.Bidder.IsPermanentlyBanned
                     && (!b.Bidder.IsSuspended || (b.Bidder.SuspendedUntil.HasValue && b.Bidder.SuspendedUntil <= DateTime.UtcNow)))
            .OrderByDescending(b => b.BidAmount)
            .ThenBy(b => b.BidTimestamp)
            .Skip(nextRank - 1)
            .FirstOrDefaultAsync();

        if (nextBid != null)
        {
            // Re-award to next ranked bidder
            listing.AwardedUserId = nextBid.BidderId;
            listing.AwardedAt = DateTime.UtcNow;
            listing.AwardDeadline = _businessDaysService.AddBusinessDays(DateTime.UtcNow, 5);
            listing.AwardRank = nextRank;
            listing.TenderStatusId = TenderStatuses.Awarded;

            await _dbContext.SaveChangesAsync();

            return Ok(new
            {
                Message = $"Winner defaulted. Tender re-awarded to rank #{nextRank} user (ID: {nextBid.BidderId}).",
                NewAwardDeadline = listing.AwardDeadline
            });
        }

        // No eligible backup bidders remaining
        listing.AwardedUserId = null;
        listing.AwardDeadline = null;
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            Message = "Winner defaulted. No remaining eligible bidders found. Listing remains defaulted."
        });
    }


    [HttpGet("{listingId:int}")]
    public async Task<ActionResult<TenderListItemResponse>> GetLiveTender(int listingId)
    {
        var user = await ResolveCurrentUserAsync();
        var role = user?.Role ?? User.FindFirst(ClaimTypes.Role)?.Value;

        var query = TenderQueryHelper.ForBidderVisibility(
            TenderQueryHelper.LiveForStaff(_dbContext),
            role);

        var tender = await query.FirstOrDefaultAsync(t => t.ListingId == listingId);

        if (tender is null)
        {
            return NotFound(new { Message = "Tender not found or not available." });
        }

        await TenderQueryHelper.ApplyViewerOfferAndSealAsync(
            _dbContext,
            new List<TenderListItemResponse> { tender },
            user?.UserId,
            CategoryAccessHelper.CanRevealCompetitiveBids(role));

        return Ok(tender);
    }

    [HttpPost("{listingId:int}/retract")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> RetractTender(int listingId, [FromBody] RetractTenderDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .Include(l => l.Bids)
                .ThenInclude(b => b.Bidder)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing == null)
            return NotFound(new { Message = "Tender listing not found." });

        if (!listing.IsActive)
            return BadRequest(new { Message = "This tender has already been cancelled or deactivated." });

        // --- UPDATE BOTH ISACTIVE AND TENDERSTATUSID ---
        listing.IsActive = false;
        listing.TenderStatusId = 7;
        listing.ClosedDate = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        // Extract unique bidders
        var bidders = listing.Bids
            .Select(b => b.Bidder)
            .Where(u => u != null && !string.IsNullOrEmpty(u.Email))
            .GroupBy(u => u.Email)
            .Select(g => g.First())
            .ToList();

        var assetName = listing.Asset?.AssetName ?? $"Listing #{listing.ListingId}";
        var referenceNumber = $"TND-{listing.ListingId}";

        foreach (var bidder in bidders)
        {
            try
            {
                var bidderName = !string.IsNullOrWhiteSpace(bidder.FullName) ? bidder.FullName : bidder.Email;
                await _emailService.SendTenderCancelledNotificationAsync(
                    bidder.Email,
                    bidderName,
                    assetName,
                    referenceNumber,
                    dto.Reason
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send cancellation email to {Email} for Listing ID {ListingId}", bidder.Email, listing.ListingId);
            }
        }

        return Ok(new { Message = $"Tender successfully cancelled. Status updated to Cancelled (7). Notification emails sent to {bidders.Count} bidder(s)." });
    }

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

        foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
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