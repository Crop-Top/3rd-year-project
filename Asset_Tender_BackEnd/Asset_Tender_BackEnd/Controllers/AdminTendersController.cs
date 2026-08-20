using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/admin/tenders")]

public class AdminTendersController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public AdminTendersController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("UserId")?.Value;

        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<CreateTenderResponse>> CreateTender(
    [FromForm] CreateTenderRequest request,
    [FromServices] IHttpClientFactory httpClientFactory,
    [FromServices] IMemoryCache cache)
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

        int uploadedBy;
        User? currentUser = null;

        if (int.TryParse(username, out var parsedUserId))
        {
            uploadedBy = parsedUserId;
            currentUser = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == uploadedBy);
        }
        else
        {
            currentUser = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == username);

            if (currentUser is null)
            {
                return Unauthorized(new { Message = "Authenticated user was not found. Please log in again." });
            }

            uploadedBy = currentUser.UserId;
        }

        var categoryExists = await _dbContext.Categories
            .AnyAsync(c => c.CategoryId == request.CategoryId);
        if (!categoryExists)
        {
            return BadRequest(new { Message = "Selected category was not found." });
        }

        // 1. Fetch Department name from third-party API helper
        var rawDepartmentName = await DepartmentApiHelper.GetDepartmentNameByCodeAsync(
            request.DepartmentID.ToString(),
            httpClientFactory,
            cache);

        // Fallback to request.DepartmentName if helper returns empty/null
        var departmentNameInput = !string.IsNullOrWhiteSpace(rawDepartmentName)
            ? rawDepartmentName
            : request.DepartmentName;

        var cleanedDepartmentName = string.IsNullOrWhiteSpace(departmentNameInput) ||
                                    departmentNameInput.Trim() == request.DepartmentID.ToString()
            ? null
            : departmentNameInput.Trim();

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

        byte[]? imageBytes = null;
        string? imageContentType = null;
        string? imageFileName = null;
        if (request.Image is not null && request.Image.Length > 0)
        {
            var prepared = await PrepareAssetImageAsync(request.Image);
            if (prepared.Error is not null)
            {
                return BadRequest(new { Message = prepared.Error });
            }

            imageBytes = prepared.Data;
            imageContentType = prepared.ContentType;
            imageFileName = prepared.FileName;
        }

        var recommendedPrice = request.OriginalPurchasePrice;

        await using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            var asset = new Inventory
            {
                AssetName = request.AssetName.Trim(),
                AssetDescription = string.IsNullOrWhiteSpace(request.AssetDescription)
                    ? null
                    : request.AssetDescription.Trim(),
                BarcodeSerial = barcode,
                CategoryId = request.CategoryId,
                DepartmentID = request.DepartmentID,
                DepartmentName = cleanedDepartmentName, // Store cleaned name or null
                CostCenter = request.CostCenter.Trim(),
                Location = request.Location.Trim(),
                AssetConditionId = condition.AssetConditionId,
                ConditionNotes = string.IsNullOrWhiteSpace(request.ConditionNotes)
                    ? null
                    : request.ConditionNotes.Trim(),
                ImageUrl = null,
                ReccomendedPrice = recommendedPrice,
                AssetStatusId = assetStatus.AssetStatusId,
                UploadedBy = uploadedBy
            };

            _dbContext.Assets.Add(asset);
            await _dbContext.SaveChangesAsync();

            if (imageBytes is not null && imageContentType is not null && imageFileName is not null)
            {
                _dbContext.AssetImages.Add(new AssetImage
                {
                    AssetId = asset.AssetId,
                    ContentType = imageContentType,
                    FileName = imageFileName,
                    Data = imageBytes,
                    UploadedAt = DateTime.UtcNow
                });
                asset.ImageUrl = $"/assets/{asset.AssetId}/image";
                await _dbContext.SaveChangesAsync();
            }

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

            // 2. Determine display name for uploader
            var uploaderFullName = currentUser != null
                ? $"{currentUser.FirstName} {currentUser.LastName}".Trim()
                : username;

            if (string.IsNullOrWhiteSpace(uploaderFullName))
            {
                uploaderFullName = currentUser?.Username ?? username;
            }

            // 3. Return response with populated string names
            return Ok(new CreateTenderResponse
            {
                ListingId = listing.ListingId,
                AssetId = asset.AssetId,
                AssetName = asset.AssetName,
                AssetDescription = asset.AssetDescription,
                BarcodeSerial = asset.BarcodeSerial,
                DepartmentName = cleanedDepartmentName,
                UploadedByName = uploaderFullName,
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
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult<IEnumerable<TenderListItemResponse>>> GetPendingTenders(
    [FromServices] IHttpClientFactory httpClientFactory)
    {
        var pending = await TenderQueryHelper.Pending(_dbContext)
            .OrderByDescending(t => t.StartTime)
            .ToListAsync();

        // Map department codes to names using NMU API
        await DepartmentApiHelper.EnrichDepartmentNamesAsync(pending, httpClientFactory);

        return Ok(pending);
    }

    [HttpGet("live")]
    public async Task<ActionResult<IEnumerable<TenderListItemResponse>>> GetLiveTenders()
    {
        var live = await TenderQueryHelper.LiveForStaff(_dbContext)
            .OrderBy(t => t.EndTime)
            .ToListAsync();

        return Ok(live);
    }

    [HttpGet("expired-unsold")]
    public async Task<IActionResult> GetExpiredUnsoldTenders()
    {
        var expiredTenders = await _dbContext.TenderListings
            .Include(l => l.Asset)
                .ThenInclude(a => a.Category)
            .Where(l => l.EndTime <= DateTime.Now
                     && (l.TenderStatusId == 6 || !l.IsActive))
            .Select(l => new ExpiredTenderDto
            {
                ListingId = l.ListingId,
                AssetId = l.AssetId,
                AssetName = l.Asset != null ? l.Asset.AssetName : "Untitled",
                CategoryName = (l.Asset != null && l.Asset.Category != null)
                    ? l.Asset.Category.CategoryName
                    : "General",
                Description = l.Asset != null ? l.Asset.AssetDescription : "",
                ImageUrl = l.Asset != null ? l.Asset.ImageUrl : null,
                StartingBid = l.StartingBid,
                EndTime = l.EndTime,
                StartTime = l.StartTime,
                BidCount = _dbContext.Bids.Count(b => b.ListingId == l.ListingId),
                LeadingBid = _dbContext.Bids
                    .Where(b => b.ListingId == l.ListingId)
                    .Max(b => (decimal?)b.BidAmount) ?? l.StartingBid,
                HasBids = _dbContext.Bids.Any(b => b.ListingId == l.ListingId)
            })
            .ToListAsync();

        return Ok(expiredTenders);
    }

    [HttpPut("{listingId:int}/relist")]
    public async Task<IActionResult> RelistTender(int listingId, [FromBody] RelistTenderRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { Message = "A new end time is required." });
        }

        var now = DateTime.UtcNow;
        if (request.EndTime <= now)
        {
            return BadRequest(new { Message = "New end time must be in the future." });
        }

        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var openStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);
        var activeStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusActive);

        if (openStatus is null || activeStatus is null ||
            listing.TenderStatusId != openStatus.TenderStatusId ||
            listing.Asset.AssetStatusId != activeStatus.AssetStatusId ||
            !listing.IsActive ||
            listing.EndTime > now)
        {
            return BadRequest(new { Message = "Only expired open tenders can be relisted." });
        }

        var hasBids = await _dbContext.Bids.AnyAsync(b => b.ListingId == listingId);
        if (hasBids)
        {
            return BadRequest(new { Message = "Tenders with bids cannot be relisted. Close as won or cancel instead." });
        }

        listing.EndTime = request.EndTime;
        if (listing.StartTime > now || listing.StartTime >= request.EndTime)
        {
            listing.StartTime = now;
        }

        listing.IsActive = true;
        listing.ClosedDate = null;
        listing.TenderStatusId = openStatus.TenderStatusId;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Tender relisted successfully.", EndTime = listing.EndTime });
    }

    [HttpPut("{listingId:int}/close")]
    public async Task<IActionResult> CloseExpiredTender(int listingId)
    {
        var now = DateTime.UtcNow;
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var openStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);
        var activeStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusActive);
        var closedStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusClosed);

        if (openStatus is null || activeStatus is null || closedStatus is null ||
            listing.TenderStatusId != openStatus.TenderStatusId ||
            listing.Asset.AssetStatusId != activeStatus.AssetStatusId ||
            !listing.IsActive ||
            listing.EndTime > now)
        {
            return BadRequest(new { Message = "Only expired open tenders can be closed." });
        }

        var hasBids = await _dbContext.Bids.AnyAsync(b => b.ListingId == listingId);
        if (!hasBids)
        {
            return BadRequest(new { Message = "Cannot close as won with no bids. Relist or cancel instead." });
        }

        listing.TenderStatusId = closedStatus.TenderStatusId;
        listing.IsActive = false;
        listing.ClosedDate = now;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Tender closed as won." });
    }

    [HttpPut("{listingId:int}/cancel")]
    public async Task<IActionResult> CancelExpiredTender(int listingId)
    {
        var now = DateTime.UtcNow;
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var openStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);
        var activeStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusActive);
        var cancelledStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusCancelled);

        if (openStatus is null || activeStatus is null || cancelledStatus is null ||
            listing.TenderStatusId != openStatus.TenderStatusId ||
            listing.Asset.AssetStatusId != activeStatus.AssetStatusId ||
            !listing.IsActive ||
            listing.EndTime > now)
        {
            return BadRequest(new { Message = "Only expired open tenders can be cancelled from this queue." });
        }

        listing.TenderStatusId = cancelledStatus.TenderStatusId;
        listing.IsActive = false;
        listing.ClosedDate = now;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Expired tender cancelled." });
    }

    /// <summary>
    /// Flag an unsold expired lot as Donation or Scrap and remove it from the auction queue.
    /// </summary>
    [HttpPut("{listingId:int}/dispose")]
    public async Task<IActionResult> DisposeExpiredTender(int listingId, [FromBody] DisposeTenderRequest request)
    {
        if (!ModelState.IsValid || string.IsNullOrWhiteSpace(request.Disposition))
        {
            return BadRequest(new { Message = "Disposition must be Donation or Scrap." });
        }

        var disposition = request.Disposition.Trim();
        string statusName;
        if (disposition.Equals(UserConstants.AssetStatusDonation, StringComparison.OrdinalIgnoreCase))
        {
            statusName = UserConstants.AssetStatusDonation;
        }
        else if (disposition.Equals(UserConstants.AssetStatusScrap, StringComparison.OrdinalIgnoreCase))
        {
            statusName = UserConstants.AssetStatusScrap;
        }
        else
        {
            return BadRequest(new { Message = "Disposition must be Donation or Scrap." });
        }

        var now = DateTime.UtcNow;
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var openStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);
        var activeStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusActive);
        var cancelledStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusCancelled);
        var dispositionStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == statusName);

        if (openStatus is null || activeStatus is null || cancelledStatus is null ||
            listing.TenderStatusId != openStatus.TenderStatusId ||
            listing.Asset.AssetStatusId != activeStatus.AssetStatusId ||
            !listing.IsActive ||
            listing.EndTime > now)
        {
            return BadRequest(new { Message = "Only expired open tenders can be disposed." });
        }

        if (dispositionStatus is null)
        {
            return BadRequest(new
            {
                Message = $"Asset status '{disposition}' is not configured in Lookup.AssetStatus."
            });
        }

        var hasBids = await _dbContext.Bids.AnyAsync(b => b.ListingId == listingId);
        if (hasBids)
        {
            return BadRequest(new
            {
                Message = "Tenders with bids cannot be marked Donation/Scrap. Close as won or cancel instead."
            });
        }

        listing.TenderStatusId = cancelledStatus.TenderStatusId;
        listing.IsActive = false;
        listing.ClosedDate = now;
        listing.Asset.AssetStatusId = dispositionStatus.AssetStatusId;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            Message = $"Unsold tender marked as {dispositionStatus.StatusName}.",
            Disposition = dispositionStatus.StatusName
        });
    }

    [HttpPut("{listingId:int}/approve")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> ApproveTender(int listingId)
    {
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
            return NotFound(new { Message = "Tender listing not found." });

        var pendingTenderStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusPending);
        var openStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);

        if (pendingTenderStatus is null || openStatus is null)
            return BadRequest(new { Message = "Status configurations missing." });

        if (listing.TenderStatusId != pendingTenderStatus.TenderStatusId)
            return BadRequest(new { Message = "Only pending tenders can be approved." });

        var currentUserId = GetCurrentUserId();
        if (currentUserId is null)
            return Unauthorized(new { Message = "Invalid user token claims." });

        // Set the ApprovedBy FK on the associated Asset
        if (listing.Asset != null)
        {
            listing.Asset.ApprovedBy = currentUserId.Value;
        }

        listing.TenderStatusId = openStatus.TenderStatusId;
        listing.IsActive = true;
        listing.PublishedDate = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Tender approved and inventory status synchronized automatically." });
    }

    [HttpPut("{listingId:int}/reject")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> RejectTender(int listingId, [FromBody] RejectTenderDto? dto)
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
            listing.Asset?.AssetStatusId != pendingAssetStatus.AssetStatusId)
        {
            return BadRequest(new { Message = "Only pending tenders can be rejected." });
        }

        // UPDATE: Fetch TenderStatusRejected instead of TenderStatusCancelled
        var rejectedTenderStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusRejected);
        var rejectedAssetStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusRejected);

        if (rejectedTenderStatus is null || rejectedAssetStatus is null)
        {
            return BadRequest(new { Message = "Rejected statuses are not configured in lookup tables." });
        }

        var currentUserId = GetCurrentUserId();
        if (currentUserId is null)
            return Unauthorized(new { Message = "Invalid user token claims." });

        listing.TenderStatusId = rejectedTenderStatus.TenderStatusId;
        listing.IsActive = false;
        listing.ClosedDate = DateTime.UtcNow;

        if (listing.Asset != null)
        {
            listing.Asset.AssetStatusId = rejectedAssetStatus.AssetStatusId;
            listing.Asset.RejectedBy = currentUserId.Value;
            listing.Asset.RejectionReason = dto?.Reason;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Tender rejected successfully." });
    }

    /// <summary>
    /// Retrieves full asset and tender details for editing.
    /// GET /api/admin/tenders/{id}/edit-details
    /// </summary>
    [HttpGet("{id}/edit-details")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<EditTenderDetailResponseDto>> GetEditDetails(int id)
    {
        var details = await (
            from asset in _dbContext.Assets.AsNoTracking()

            join listing in _dbContext.TenderListings.AsNoTracking()
                on asset.AssetId equals listing.AssetId into listingGroup
            from listing in listingGroup.DefaultIfEmpty()

            join category in _dbContext.Categories.AsNoTracking()
                on asset.CategoryId equals category.CategoryId into catGroup
            from category in catGroup.DefaultIfEmpty()

            join condition in _dbContext.AssetConditions.AsNoTracking()
                on asset.AssetConditionId equals condition.AssetConditionId into condGroup
            from condition in condGroup.DefaultIfEmpty()

            join assetStatus in _dbContext.AssetStatuses.AsNoTracking()
                on asset.AssetStatusId equals assetStatus.AssetStatusId into astGroup
            from assetStatus in astGroup.DefaultIfEmpty()

            join uploader in _dbContext.Users.AsNoTracking()
                on asset.UploadedBy equals uploader.UserId into upGroup
            from uploader in upGroup.DefaultIfEmpty()

            join approver in _dbContext.Users.AsNoTracking()
                on asset.ApprovedBy equals approver.UserId into appGroup
            from approver in appGroup.DefaultIfEmpty()

            join rejecter in _dbContext.Users.AsNoTracking()
                on asset.RejectedBy equals rejecter.UserId into rejGroup
            from rejecter in rejGroup.DefaultIfEmpty()

                // Fixed boolean logic for reliable SQL translation
            where (listing != null && listing.ListingId == id) || asset.AssetId == id

            select new EditTenderDetailResponseDto
            {
                ListingId = listing != null ? listing.ListingId : asset.AssetId,
                AssetId = asset.AssetId,
                Title = asset.AssetName ?? "N/A",
                BarcodeSerial = asset.BarcodeSerial ?? string.Empty,
                CategoryId = asset.CategoryId,
                CategoryName = category != null ? category.CategoryName : string.Empty,
                DepartmentId = asset.DepartmentID,
                DepartmentName = !string.IsNullOrWhiteSpace(asset.DepartmentName) ? asset.DepartmentName : string.Empty,
                CostCenter = asset.CostCenter ?? string.Empty,
                Location = asset.Location ?? string.Empty,
                Description = asset.AssetDescription ?? string.Empty,
                AssetConditionId = asset.AssetConditionId,
                ConditionName = condition != null ? condition.ConditionName : string.Empty,
                ConditionNotes = asset.ConditionNotes ?? string.Empty,
                ImageUrl = asset.ImageUrl,
                RecommendedPrice = asset.ReccomendedPrice,
                StartingBid = listing != null ? listing.StartingBid : asset.ReccomendedPrice,
                LeadingBid = listing != null
                    ? (_dbContext.Bids
                        .Where(b => b.ListingId == listing.ListingId)
                        .Select(b => (decimal?)b.BidAmount)
                        .Max() ?? listing.StartingBid)
                    : asset.ReccomendedPrice,
                Status = assetStatus != null ? assetStatus.StatusName : "Active",

                UploadedBy = uploader != null ? (uploader.FullName ?? uploader.Username) : "N/A",
                ApprovedBy = approver != null ? (approver.FullName ?? approver.Username) : null,
                RejectedBy = rejecter != null ? (rejecter.FullName ?? rejecter.Username) : null,
                RejectionReason = asset.RejectionReason
            }
        ).FirstOrDefaultAsync();

        if (details == null)
        {
            return NotFound(new { message = $"No asset or tender found matching ID {id}." });
        }

        return Ok(details);
    }

    /// <summary>
    /// Updates asset and tender details by Listing ID or Asset ID.
    /// PUT /api/admin/tenders/{id}
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> UpdateTender(int id, [FromBody] UpdateTenderRequestDto dto)
    {
        if (dto == null)
        {
            return BadRequest(new { message = "Invalid request payload." });
        }

        // 1. Locate the listing (Ensure NO AsNoTracking() is used here)
        var listing = await _dbContext.TenderListings
            .FirstOrDefaultAsync(l => l.ListingId == id || l.AssetId == id);

        // 2. Locate the target asset
        int targetAssetId = listing?.AssetId ?? id;
        var asset = await _dbContext.Assets
            .FirstOrDefaultAsync(a => a.AssetId == targetAssetId);

        if (asset == null)
        {
            return NotFound(new { message = $"No asset found with ID {targetAssetId}." });
        }

        // 3. Mutate Asset properties directly
        asset.AssetName = dto.Title;
        asset.BarcodeSerial = dto.BarcodeSerial;
        asset.CategoryId = dto.CategoryId;
        asset.DepartmentName = dto.DepartmentName;
        asset.CostCenter = dto.CostCenter;
        asset.Location = dto.Location;
        asset.AssetDescription = dto.Description;
        asset.AssetConditionId = dto.AssetConditionId;
        asset.ConditionNotes = dto.ConditionNotes;
        asset.ReccomendedPrice = dto.RecommendedPrice;

        if (!string.IsNullOrWhiteSpace(dto.ImageUrl))
        {
            asset.ImageUrl = dto.ImageUrl;
        }

        // Force EF Core to mark the entity state as Modified
        _dbContext.Entry(asset).State = EntityState.Modified;

        // 4. Update Tender Listing starting bid if present
        if (listing != null)
        {
            listing.StartingBid = dto.StartingBid;
            _dbContext.Entry(listing).State = EntityState.Modified;
        }

        // 5. Commit and verify rows updated
        int rowsAffected = await _dbContext.SaveChangesAsync();

        if (rowsAffected == 0)
        {
            return StatusCode(500, new { message = "Failed to update database. No records were modified." });
        }

        return Ok(new { message = "Tender details updated successfully.", assetId = asset.AssetId });
    }

    private static async Task<(byte[]? Data, string? ContentType, string? FileName, string? Error)> PrepareAssetImageAsync(IFormFile image)
    {
        var allowed = new[] { "image/png", "image/jpeg", "image/jpg" };
        if (!allowed.Contains(image.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return (null, null, null, "Image must be a PNG or JPG file.");
        }

        if (image.Length > 5 * 1024 * 1024)
        {
            return (null, null, null, "Image must be 5MB or smaller.");
        }

        var extension = Path.GetExtension(image.FileName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = image.ContentType.Contains("png", StringComparison.OrdinalIgnoreCase) ? ".png" : ".jpg";
        }

        var safeName = Path.GetFileNameWithoutExtension(image.FileName);
        if (string.IsNullOrWhiteSpace(safeName))
        {
            safeName = "asset";
        }

        var fileName = $"{safeName}{extension.ToLowerInvariant()}";
        if (fileName.Length > 260)
        {
            fileName = $"asset{extension.ToLowerInvariant()}";
        }

        await using var memory = new MemoryStream();
        await image.CopyToAsync(memory);
        return (memory.ToArray(), image.ContentType, fileName, null);
    }
}
