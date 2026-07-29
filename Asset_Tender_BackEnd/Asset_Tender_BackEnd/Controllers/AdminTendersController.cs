using System.Security.Claims;
using Asset_Tender_BackEnd.Constants;
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
[Route("api/admin/tenders")]
[Authorize(Roles = "Admin")]
public class AdminTendersController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IWebHostEnvironment _environment;

    public AdminTendersController(Asset_Tender_DBContext dbContext, IWebHostEnvironment environment)
    {
        _dbContext = dbContext;
        _environment = environment;
    }

    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<CreateTenderResponse>> CreateTender([FromForm] CreateTenderRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (request.EndTime <= request.StartTime)
        {
            return BadRequest(new { Message = "End time must be after the start time." });
        }

        var username =
            User.FindFirstValue(ClaimTypes.Name) ??
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(username))
        {
            return Unauthorized(new { Message = "Authenticated user is missing from the token. Please log in again." });
        }

        // Prefer a numeric NameIdentifier if present; otherwise resolve UploadedBy from username (sub).
        int uploadedBy;
        if (int.TryParse(username, out var parsedUserId))
        {
            uploadedBy = parsedUserId;
        }
        else
        {
            var currentUser = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == username);

            if (currentUser is null)
            {
                return Unauthorized(new { Message = "Authenticated user was not found. Please log in again." });
            }

            uploadedBy = currentUser.UserId;
        }

        var departmentExists = await _dbContext.Departments
            .AnyAsync(d => d.DepartmentID == request.DepartmentID);
        if (!departmentExists)
        {
            return BadRequest(new { Message = "Selected department was not found." });
        }

        var categoryExists = await _dbContext.Categories
            .AnyAsync(c => c.CategoryId == request.CategoryId);
        if (!categoryExists)
        {
            return BadRequest(new { Message = "Selected category was not found." });
        }

        var condition = await _dbContext.AssetConditions
            .FirstOrDefaultAsync(c => c.ConditionName == request.ConditionGrade.Trim());
        if (condition is null)
        {
            return BadRequest(new { Message = "Selected condition grade was not found." });
        }

        var assetStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusPending);
        if (assetStatus is null)
        {
            return BadRequest(new { Message = "Pending asset status is not configured in Lookup.AssetStatus." });
        }

        var tenderStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusPending);
        if (tenderStatus is null)
        {
            return BadRequest(new { Message = "Pending tender status is not configured in Lookup.TenderStatus." });
        }

        var barcode = string.IsNullOrWhiteSpace(request.BarcodeSerial)
            ? null
            : request.BarcodeSerial.Trim();

        if (barcode is not null)
        {
            var barcodeTaken = await _dbContext.Assets
                .AnyAsync(a => a.BarcodeSerial == barcode);
            if (barcodeTaken)
            {
                return Conflict(new { Message = "An asset with this barcode / serial already exists." });
            }
        }

        string? imageUrl = null;
        if (request.Image is not null && request.Image.Length > 0)
        {
            var saved = await SaveAssetImageAsync(request.Image);
            if (saved.Error is not null)
            {
                return BadRequest(new { Message = saved.Error });
            }

            imageUrl = saved.Url;
        }

        var recommendedPrice = Math.Round(request.OriginalPurchasePrice * 0.05m, 2, MidpointRounding.AwayFromZero);

        await using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            var asset = new Inventory
            {
                AssetName = request.AssetName.Trim(),
                BarcodeSerial = barcode,
                CategoryId = request.CategoryId,
                DepartmentID = request.DepartmentID,
                CostCenter = request.CostCenter.Trim(),
                Location = request.Location.Trim(),
                AssetConditionId = condition.AssetConditionId,
                ConditionNotes = string.IsNullOrWhiteSpace(request.ConditionNotes)
                    ? null
                    : request.ConditionNotes.Trim(),
                ImageUrl = imageUrl,
                ReccomendedPrice = recommendedPrice,
                AssetStatusId = assetStatus.AssetStatusId,
                UploadedBy = uploadedBy
            };

            _dbContext.Assets.Add(asset);
            await _dbContext.SaveChangesAsync();

            var listing = new TenderListing
            {
                AssetId = asset.AssetId,
                StartingBid = request.StartingBid,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                TenderStatusId = tenderStatus.TenderStatusId,
                IsActive = false,
                PublishedDate = null
            };

            _dbContext.TenderListings.Add(listing);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new CreateTenderResponse
            {
                ListingId = listing.ListingId,
                AssetId = asset.AssetId,
                AssetName = asset.AssetName,
                BarcodeSerial = asset.BarcodeSerial,
                RecommendedPrice = asset.ReccomendedPrice,
                StartingBid = listing.StartingBid,
                StartTime = listing.StartTime,
                EndTime = listing.EndTime,
                ImageUrl = asset.ImageUrl,
                Message = "Tender submitted for admin approval."
            });
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<TenderListItemResponse>>> GetPendingTenders()
    {
        var pending = await TenderQueryHelper.Pending(_dbContext)
            .OrderByDescending(t => t.StartTime)
            .ToListAsync();

        return Ok(pending);
    }

    [HttpPut("{listingId:int}/approve")]
    public async Task<IActionResult> ApproveTender(int listingId)
    {
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var pendingTenderStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusPending);
        var pendingAssetStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusPending);

        if (pendingTenderStatus is null || pendingAssetStatus is null ||
            listing.TenderStatusId != pendingTenderStatus.TenderStatusId ||
            listing.Asset.AssetStatusId != pendingAssetStatus.AssetStatusId)
        {
            return BadRequest(new { Message = "Only pending tenders can be approved." });
        }

        var openStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);
        var activeStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusActive);

        if (openStatus is null || activeStatus is null)
        {
            return BadRequest(new { Message = "Open/Active statuses are not configured in lookup tables." });
        }

        listing.TenderStatusId = openStatus.TenderStatusId;
        listing.IsActive = true;
        listing.PublishedDate = DateTime.UtcNow;
        listing.Asset.AssetStatusId = activeStatus.AssetStatusId;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Tender approved and published for staff browsing." });
    }

    [HttpPut("{listingId:int}/reject")]
    public async Task<IActionResult> RejectTender(int listingId)
    {
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var pendingTenderStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusPending);
        var pendingAssetStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusPending);

        if (pendingTenderStatus is null || pendingAssetStatus is null ||
            listing.TenderStatusId != pendingTenderStatus.TenderStatusId ||
            listing.Asset.AssetStatusId != pendingAssetStatus.AssetStatusId)
        {
            return BadRequest(new { Message = "Only pending tenders can be rejected." });
        }

        var cancelledStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusCancelled);
        var rejectedStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusRejected);

        if (cancelledStatus is null || rejectedStatus is null)
        {
            return BadRequest(new { Message = "Cancelled/Rejected statuses are not configured in lookup tables." });
        }

        listing.TenderStatusId = cancelledStatus.TenderStatusId;
        listing.IsActive = false;
        listing.ClosedDate = DateTime.UtcNow;
        listing.Asset.AssetStatusId = rejectedStatus.AssetStatusId;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Tender rejected." });
    }

    private async Task<(string? Url, string? Error)> SaveAssetImageAsync(IFormFile image)
    {
        var allowed = new[] { "image/png", "image/jpeg", "image/jpg" };
        if (!allowed.Contains(image.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return (null, "Image must be a PNG or JPG file.");
        }

        if (image.Length > 5 * 1024 * 1024)
        {
            return (null, "Image must be 5MB or smaller.");
        }

        var extension = Path.GetExtension(image.FileName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = image.ContentType.Contains("png", StringComparison.OrdinalIgnoreCase) ? ".png" : ".jpg";
        }

        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var uploadsDir = Path.Combine(webRoot, "uploads", "assets");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var physicalPath = Path.Combine(uploadsDir, fileName);

        await using (var stream = System.IO.File.Create(physicalPath))
        {
            await image.CopyToAsync(stream);
        }

        return ($"/uploads/assets/{fileName}", null);
    }
}
