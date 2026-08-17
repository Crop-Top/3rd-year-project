using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Asset_Tender_BackEnd.Models;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/tenders")]
[Authorize(Roles = "Staff, Bidder, Admin, SuperAdmin")]
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
