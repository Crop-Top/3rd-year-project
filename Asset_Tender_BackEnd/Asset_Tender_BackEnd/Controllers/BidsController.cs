using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Entities;
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
    private readonly IWebHostEnvironment _environment;

    public WinningBidsController(Asset_Tender_DBContext dbContext, IWebHostEnvironment environment)
    {
        _dbContext = dbContext;
        _environment = environment;
    }

    /// <summary>
    /// Retrieves all winning bids placed by the authenticated user.
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

        // 1. Fetch raw data from SQL using exact properties from Inventory.cs
        var rawBids = await _dbContext.Bids
            .AsNoTracking()
            .Include(b => b.Listing)
                .ThenInclude(l => l.Asset)
            .Where(b => b.BidderId == user.UserId)
            .Where(b => !b.Listing.IsActive || b.Listing.EndTime <= now)
            .OrderByDescending(b => b.Listing.EndTime)
            .Select(b => new
            {
                BidId = b.BidId,
                BidAmount = b.BidAmount,
                EndTime = b.Listing.EndTime,
                Title = b.Listing.Asset != null ? b.Listing.Asset.AssetName : "Asset Tender Lot",
                Serial = b.Listing.Asset != null ? b.Listing.Asset.BarcodeSerial : "N/A",
                Image = b.Listing.Asset != null ? b.Listing.Asset.ImageUrl : null
            })
            .ToListAsync();

        // 2. Format dates and coalesce null values in memory
        var userWinningBids = rawBids.Select(b => new
        {
            id = b.BidId,
            title = b.Title ?? "Asset Tender Lot",
            serial = string.IsNullOrWhiteSpace(b.Serial) ? "N/A" : b.Serial,
            wonDate = b.EndTime.ToString("dd MMM yyyy"),
            image = b.Image,
            amount = b.BidAmount,
            status = "Pending POP",
            action = "Upload POP",
            document = "Invoice"
        }).ToList();

        return Ok(userWinningBids);
    }

    /// <summary>
    /// Uploads a Proof of Payment (POP) PDF document for a specific winning bid.
    /// POST /api/bids/{id}/upload-pop
    /// </summary>
    [HttpPost("{id:int}/upload-pop")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadProofOfPayment(int id, [FromForm] UploadPopDto dto)
    {
        var file = dto?.File;

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { Message = "No file uploaded. Please attach a valid PDF document." });
        }

        if (!file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) &&
            !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { Message = "Invalid file type. Only PDF documents are allowed." });
        }

        const long maxFileSizeBytes = 5 * 1024 * 1024; // 5 MB Limit
        if (file.Length > maxFileSizeBytes)
        {
            return BadRequest(new { Message = "File size exceeds the maximum allowed limit of 5MB." });
        }

        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { Message = "Authenticated user could not be resolved. Please sign in again." });
        }

        var winningBid = await _dbContext.Bids
            .FirstOrDefaultAsync(b => b.BidId == id && b.BidderId == user.UserId);

        if (winningBid is null)
        {
            return NotFound(new { Message = "Winning bid record not found or does not belong to the current user." });
        }

        try
        {
            var uploadsFolder = Path.Combine(_environment.ContentRootPath, "UploadedDocuments", "PaymentProofs");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var safeFileName = $"POP_Bid_{id}_{Guid.NewGuid():N}.pdf";
            var fullPath = Path.Combine(uploadsFolder, safeFileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { Message = "Proof of payment uploaded successfully. Verification is in progress." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Message = "An error occurred while saving the uploaded document.", Detail = ex.Message });
        }
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