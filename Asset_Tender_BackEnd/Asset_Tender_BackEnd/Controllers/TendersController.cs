using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
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

    public TendersController(
        Asset_Tender_DBContext dbContext,
        IEmailService emailService,
        ILogger<TendersController> logger)
    {
        _dbContext = dbContext;
        _emailService = emailService;
        _logger = logger;
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