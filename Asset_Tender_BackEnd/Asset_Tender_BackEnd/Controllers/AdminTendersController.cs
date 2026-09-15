using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
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
    private readonly IAuditLogService _auditLogService;

    public AdminTendersController(Asset_Tender_DBContext dbContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _auditLogService = auditLogService;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("UserId")?.Value;

        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    /// <summary>
    /// Live tender statuses: seed "Open" and campus "Active".
    /// </summary>
    private async Task<List<int>> GetOpenTenderStatusIdsAsync()
    {
        return await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == UserConstants.TenderStatusOpen
                     || s.StatusName == UserConstants.TenderStatusActive)
            .Select(s => s.TenderStatusId)
            .ToListAsync();
    }

    /// <summary>
    /// Campus SP marks past-end unsold lots as "Expired" (legacy id 6).
    /// </summary>
    private async Task<List<int>> GetExpiredTenderStatusIdsAsync()
    {
        return await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == UserConstants.TenderStatusExpired)
            .Select(s => s.TenderStatusId)
            .ToListAsync();
    }

    /// <summary>
    /// Won / closed-as-won: seed "Closed" and campus "Awarded".
    /// </summary>
    private async Task<List<int>> GetWonTenderStatusIdsAsync()
    {
        return await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == UserConstants.TenderStatusClosed
                     || s.StatusName == UserConstants.TenderStatusAwarded)
            .Select(s => s.TenderStatusId)
            .ToListAsync();
    }

    private async Task<int?> ResolveWonTenderStatusIdAsync()
    {
        var won = await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == UserConstants.TenderStatusClosed
                     || s.StatusName == UserConstants.TenderStatusAwarded)
            .OrderBy(s => s.StatusName == UserConstants.TenderStatusAwarded ? 0 : 1)
            .Select(s => (int?)s.TenderStatusId)
            .FirstOrDefaultAsync();
        return won;
    }

    /// <summary>
    /// Use local server time (same as Live/Expired query helpers and campus SP) so EndTime checks agree.
    /// </summary>
    private static DateTime AppNow() => DateTime.Now;

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
        var pendingName = UserConstants.PaymentStatusPendingPop;
        var processingName = UserConstants.PaymentStatusProcessing;
        var verifiedName = UserConstants.PaymentStatusVerified;
        var now = AppNow();
        var openStatusIds = await GetOpenTenderStatusIdsAsync();
        var expiredStatusIds = await GetExpiredTenderStatusIdsAsync();
        var wonStatusIds = await GetWonTenderStatusIdsAsync();

        // Campus: Tender.sp_ProcessExpiredTenders sets IsActive=0 and TenderStatus=Expired (id 6).
        // Old filter was (TenderStatusId == 6 || !IsActive). Keep that queue AND still-open past-end lots.
        var listings = await (
            from l in _dbContext.TenderListings.AsNoTracking()
            join a in _dbContext.Assets.AsNoTracking() on l.AssetId equals a.AssetId
            join c in _dbContext.Categories.AsNoTracking() on a.CategoryId equals c.CategoryId into catGroup
            from c in catGroup.DefaultIfEmpty()
            where l.EndTime <= now
                  && (
                      !l.IsActive
                      || expiredStatusIds.Contains(l.TenderStatusId)
                      || wonStatusIds.Contains(l.TenderStatusId)
                      || openStatusIds.Contains(l.TenderStatusId)
                  )
            select new
            {
                l.ListingId,
                l.AssetId,
                l.TenderStatusId,
                l.StartingBid,
                l.StartTime,
                l.EndTime,
                AssetName = a.AssetName,
                CategoryName = c != null ? c.CategoryName : null,
                Description = a.AssetDescription,
                a.ImageUrl
            }
        ).ToListAsync();

        // Ensure closed-as-won lots awaiting POP are present even if the base filter misses them.
        var awaitingPopListingIds = await (
            from inv in _dbContext.Invoices.AsNoTracking()
            join bid in _dbContext.Bids.AsNoTracking() on inv.WinningBidId equals bid.BidId
            join ps in _dbContext.PaymentStatuses.AsNoTracking() on inv.PaymentStatusId equals ps.PaymentStatusId
            where (ps.StatusName == pendingName || ps.StatusName == processingName)
                  && !_dbContext.ProofOfPayments.Any(p => p.InvoiceId == inv.InvoiceId)
            select bid.ListingId
        ).Distinct().ToListAsync();

        var missingIds = awaitingPopListingIds
            .Where(id => listings.All(l => l.ListingId != id))
            .ToList();

        if (missingIds.Count > 0)
        {
            var extras = await (
                from l in _dbContext.TenderListings.AsNoTracking()
                join a in _dbContext.Assets.AsNoTracking() on l.AssetId equals a.AssetId
                join c in _dbContext.Categories.AsNoTracking() on a.CategoryId equals c.CategoryId into catGroup
                from c in catGroup.DefaultIfEmpty()
                where missingIds.Contains(l.ListingId)
                select new
                {
                    l.ListingId,
                    l.AssetId,
                    l.TenderStatusId,
                    l.StartingBid,
                    l.StartTime,
                    l.EndTime,
                    AssetName = a.AssetName,
                    CategoryName = c != null ? c.CategoryName : null,
                    Description = a.AssetDescription,
                    a.ImageUrl
                }
            ).ToListAsync();
            listings.AddRange(extras);
        }

        var listingIds = listings.Select(l => l.ListingId).ToList();
        var bids = await _dbContext.Bids
            .AsNoTracking()
            .Where(b => listingIds.Contains(b.ListingId))
            .ToListAsync();

        var winningBidIds = bids
            .GroupBy(b => b.ListingId)
            .Select(g => g.OrderByDescending(b => b.BidAmount)
                .ThenByDescending(b => b.BidTimestamp)
                .First().BidId)
            .ToList();

        var invoices = await _dbContext.Invoices
            .AsNoTracking()
            .Include(i => i.PaymentStatus)
            .Include(i => i.ProofOfPayment)
            .Include(i => i.Buyer)
            .Where(i => winningBidIds.Contains(i.WinningBidId))
            .ToListAsync();

        var result = new List<ExpiredTenderDto>();
        foreach (var listing in listings)
        {
            var listingBids = bids.Where(b => b.ListingId == listing.ListingId).ToList();
            var winningBid = listingBids
                .OrderByDescending(b => b.BidAmount)
                .ThenByDescending(b => b.BidTimestamp)
                .FirstOrDefault();

            var invoice = winningBid is null
                ? null
                : invoices.FirstOrDefault(i => i.WinningBidId == winningBid.BidId);

            var hasPop = invoice?.ProofOfPayment is not null;
            var paymentStatus = invoice?.PaymentStatus?.StatusName;

            var isPaidOrVerified = hasPop
                || string.Equals(paymentStatus, verifiedName, StringComparison.OrdinalIgnoreCase)
                || listing.TenderStatusId == 9; // 9 = Collected

            var isAwaitingPop = invoice is not null && !isPaidOrVerified;

            var isClosedAsWon = isAwaitingPop
                || isPaidOrVerified
                || wonStatusIds.Contains(listing.TenderStatusId)
                || listing.TenderStatusId == 8; // 8 = Awarded

            result.Add(new ExpiredTenderDto
            {
                ListingId = listing.ListingId,
                AssetId = listing.AssetId,
                AssetName = listing.AssetName ?? "Untitled",
                CategoryName = listing.CategoryName ?? "General",
                Description = listing.Description ?? "",
                ImageUrl = listing.ImageUrl,
                StartingBid = listing.StartingBid,
                StartTime = listing.StartTime,
                EndTime = listing.EndTime,
                BidCount = listingBids.Count,
                LeadingBid = winningBid?.BidAmount ?? listing.StartingBid,
                HasBids = listingBids.Count > 0,
                IsClosedAsWon = isClosedAsWon,
                HasProofOfPayment = isPaidOrVerified,
                PaymentStatus = isPaidOrVerified ? "Paid" : (paymentStatus ?? "Pending"),
                InvoiceId = invoice?.InvoiceId,
                WinningBidAmount = winningBid?.BidAmount,
                WinnerName = invoice?.Buyer?.FullName ?? invoice?.Buyer?.Username
            });
        }

        return Ok(result);
    }

    [HttpPut("{listingId:int}/relist")]
    public async Task<IActionResult> RelistTender(int listingId, [FromBody] RelistTenderRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { Message = "A new end time is required." });
        }

        var now = AppNow();
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

        var openStatusIds = await GetOpenTenderStatusIdsAsync();
        var expiredStatusIds = await GetExpiredTenderStatusIdsAsync();
        var liveStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusActive)
            ?? await _dbContext.TenderStatuses
                .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);
        var activeAssetStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusActive);

        var eligibleForRelist =
            openStatusIds.Contains(listing.TenderStatusId)
            || expiredStatusIds.Contains(listing.TenderStatusId)
            || !listing.IsActive;

        if (liveStatus is null || activeAssetStatus is null ||
            !eligibleForRelist ||
            listing.EndTime > now)
        {
            return BadRequest(new { Message = "Only expired tenders can be relisted." });
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
        listing.TenderStatusId = liveStatus.TenderStatusId;
        listing.Asset.AssetStatusId = activeAssetStatus.AssetStatusId;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Tender relisted successfully.", EndTime = listing.EndTime });
    }

    [HttpPut("{listingId:int}/close")]
    public async Task<IActionResult> CloseExpiredTender(int listingId)
    {
        var now = AppNow();
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        // Resolve Status 9 (Collected) from Lookup.TenderStatus
        var collectedStatus = await _dbContext.TenderStatuses
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.StatusName == "Collected" || s.TenderStatusId == 9);

        int collectedStatusId = collectedStatus?.TenderStatusId ?? 9;

        var blockedStatusIds = await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == UserConstants.TenderStatusCancelled
                     || s.StatusName == UserConstants.TenderStatusRejected)
            .Select(s => s.TenderStatusId)
            .ToListAsync();

        // Prevent processing if already marked as Collected (9) or Blocked
        if (listing.TenderStatusId == collectedStatusId || blockedStatusIds.Contains(listing.TenderStatusId))
        {
            return BadRequest(new { Message = "This tender has already been marked as collected or is cancelled." });
        }

        // Locate the winning bid
        var winningBid = await _dbContext.Bids
            .Where(b => b.ListingId == listingId)
            .OrderByDescending(b => b.BidAmount)
            .ThenByDescending(b => b.BidTimestamp)
            .FirstOrDefaultAsync();

        if (winningBid is null)
        {
            return BadRequest(new { Message = "Cannot mark as collected without any bids. Relist or cancel instead." });
        }

        // 1. UPDATE OR CREATE WINNING BID WITH 'Collected' STATUS
        string winningBidStatus = "Collected";

        var winningBidRecord = await _dbContext.WinningBids
            .FirstOrDefaultAsync(w => w.BidId == winningBid.BidId);

        if (winningBidRecord is null)
        {
            _dbContext.WinningBids.Add(new WinningBid
            {
                BidId = winningBid.BidId,
                UserId = winningBid.BidderId,
                LotTitle = listing.Asset?.AssetName ?? "Untitled Asset",
                SerialNumber = listing.Asset?.BarcodeSerial ?? string.Empty,
                Amount = winningBid.BidAmount,
                WonDate = now,
                Status = winningBidStatus,
                ImageUrl = listing.Asset?.ImageUrl ?? string.Empty
            });
        }
        else
        {
            winningBidRecord.Status = winningBidStatus;
        }

        // 2. UPDATE LISTING TO STATUS 9 (Collected)
        listing.TenderStatusId = collectedStatusId;
        listing.IsActive = false;
        listing.ClosedDate = now;
        listing.AwardedUserId = winningBid.BidderId;
        listing.AwardedAt ??= now;
        listing.AwardDeadline = null;

        await _dbContext.SaveChangesAsync();

        var closeUserId = GetCurrentUserId();
        if (closeUserId is int uid)
        {
            await _auditLogService.TryLogAsync(uid, "TenderCollected", "Tender.Listings", listingId);
        }

        return Ok(new { Message = "Tender successfully marked as collected.", WinningBidId = winningBid.BidId });
    }

    [HttpPut("{listingId:int}/cancel")]
    public async Task<IActionResult> CancelExpiredTender(int listingId)
    {
        var now = AppNow();
        var listing = await _dbContext.TenderListings
            .Include(l => l.Asset)
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var openStatusIds = await GetOpenTenderStatusIdsAsync();
        var activeStatus = await _dbContext.AssetStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.AssetStatusActive);
        var cancelledStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusCancelled);

        if (activeStatus is null || cancelledStatus is null || openStatusIds.Count == 0 ||
            !openStatusIds.Contains(listing.TenderStatusId) ||
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

        var cancelUserId = GetCurrentUserId();
        if (cancelUserId is int uid)
        {
            await _auditLogService.TryLogAsync(uid, "TenderCancelled", "Tender.Listings", listingId);
        }

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

        var disposeUserId = GetCurrentUserId();
        if (disposeUserId is int uid)
        {
            await _auditLogService.TryLogAsync(
                uid,
                "TenderDisposed",
                "Tender.Listings",
                listingId,
                dispositionStatus.StatusName);
        }

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

        //var pendingTenderStatus = await _dbContext.TenderStatuses
        //    .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusPending);
        //var openStatus = await _dbContext.TenderStatuses
        //    .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen);
        var pendingTenderStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusPending); // Matches "Pending" (ID 1)

        var openStatus = await _dbContext.TenderStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.TenderStatusOpen
                                   || s.StatusName == "Active"); // Matches "Active" (ID 2)

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

        await _auditLogService.TryLogAsync(currentUserId.Value, "TenderApproved", "Tender.Listings", listingId);

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
            listing.Asset.RejectedBy = currentUserId.Value.ToString();
            listing.Asset.RejectionReason = dto?.Reason;
        }

        await _dbContext.SaveChangesAsync();

        await _auditLogService.TryLogAsync(
            currentUserId.Value,
            "TenderRejected",
            "Tender.Listings",
            listingId,
            dto?.Reason);

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
                on asset.RejectedBy equals rejecter.UserId.ToString() into rejGroup
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

    private static bool TryResolvePopContentType(string? fileName, string? reportedType, out string storedContentType)
    {
        var extension = Path.GetExtension(fileName ?? "")?.ToLowerInvariant() ?? "";
        var contentType = (reportedType ?? "").Trim().ToLowerInvariant();

        if (extension == ".pdf" || contentType == "application/pdf")
        {
            storedContentType = "application/pdf";
            return true;
        }

        if (extension is ".jpg" or ".jpeg" || contentType is "image/jpeg" or "image/jpg")
        {
            storedContentType = "image/jpeg";
            return true;
        }

        if (extension == ".png" || contentType == "image/png")
        {
            storedContentType = "image/png";
            return true;
        }

        // Browsers sometimes send octet-stream for scanned POP files — trust the extension.
        if (contentType is "application/octet-stream" or "")
        {
            storedContentType = extension switch
            {
                ".pdf" => "application/pdf",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                _ => ""
            };
            return storedContentType.Length > 0;
        }

        storedContentType = "";
        return false;
    }

    /// <summary>
    /// SuperAdmin uploads Proof of Payment (PDF / JPG / PNG) for a closed-as-won tender.
    /// POST /api/admin/tenders/{listingId}/proof-of-payment
    /// </summary>
    [HttpPost("{listingId:int}/proof-of-payment")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> UploadProofOfPayment(int listingId, [FromForm] UploadProofOfPaymentRequest request)
    {
        var file = request?.File;
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { Message = "A proof of payment file is required (PDF, JPG, or PNG)." });
        }

        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new { Message = "Proof of payment must be 5MB or smaller." });
        }

        if (!TryResolvePopContentType(file.FileName, file.ContentType, out var storedContentType))
        {
            return BadRequest(new { Message = "Proof of payment must be a PDF, JPG, or PNG file." });
        }

        // Campus uses Awarded (and sometimes Closed); accept any configured won status.
        var wonStatusIds = await GetWonTenderStatusIdsAsync();
        if (wonStatusIds.Count == 0)
        {
            return StatusCode(500, new
            {
                Message = "Won tender status is not configured (need 'Awarded' or 'Closed' in Lookup.TenderStatus)."
            });
        }

        var listing = await _dbContext.TenderListings
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        if (!wonStatusIds.Contains(listing.TenderStatusId))
        {
            return BadRequest(new { Message = "Proof of payment can only be uploaded for tenders closed as won." });
        }

        var winningBid = await _dbContext.Bids
            .Where(b => b.ListingId == listingId)
            .OrderByDescending(b => b.BidAmount)
            .ThenByDescending(b => b.BidTimestamp)
            .FirstOrDefaultAsync();

        if (winningBid is null)
        {
            return BadRequest(new { Message = "No winning bid found for this tender." });
        }

        var invoice = await _dbContext.Invoices
            .Include(i => i.ProofOfPayment)
            .FirstOrDefaultAsync(i => i.WinningBidId == winningBid.BidId);

        if (invoice is null)
        {
            return BadRequest(new { Message = "No invoice found for this won tender. Close as won again or contact support." });
        }

        var verifiedStatus = await _dbContext.PaymentStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.PaymentStatusVerified);
        if (verifiedStatus is null)
        {
            return StatusCode(500, new { Message = "Payment status 'Verified' is not configured." });
        }

        await using var memory = new MemoryStream();
        await file.CopyToAsync(memory);
        var bytes = memory.ToArray();
        var safeName = Path.GetFileName(file.FileName);
        if (string.IsNullOrWhiteSpace(safeName))
        {
            var fallbackExt = storedContentType switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                _ => ".pdf"
            };
            safeName = $"POP_{listingId}{fallbackExt}";
        }

        if (invoice.ProofOfPayment is not null)
        {
            invoice.ProofOfPayment.ContentType = storedContentType;
            invoice.ProofOfPayment.FileName = safeName;
            invoice.ProofOfPayment.Data = bytes;
            invoice.ProofOfPayment.UploadedAt = DateTime.UtcNow;
        }
        else
        {
            _dbContext.ProofOfPayments.Add(new ProofOfPayment
            {
                InvoiceId = invoice.InvoiceId,
                ContentType = storedContentType,
                FileName = safeName,
                Data = bytes,
                UploadedAt = DateTime.UtcNow
            });
        }

        invoice.PaymentStatusId = verifiedStatus.PaymentStatusId;
        invoice.ProofOfPaymentUrl = $"/api/admin/tenders/{listingId}/proof-of-payment";

        await _dbContext.SaveChangesAsync();

        var uploaderId = GetCurrentUserId();
        if (uploaderId is int uid)
        {
            await _auditLogService.TryLogAsync(uid, "ProofOfPaymentUploaded", "Tender.Invoices", invoice.InvoiceId);
        }

        return Ok(new
        {
            Message = "Proof of payment uploaded and marked Verified.",
            InvoiceId = invoice.InvoiceId,
            ListingId = listingId
        });
    }

    /// <summary>
    /// SuperAdmin downloads the stored Proof of Payment for a closed-as-won tender.
    /// GET /api/admin/tenders/{listingId}/proof-of-payment
    /// </summary>
    [HttpGet("{listingId:int}/proof-of-payment")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> DownloadProofOfPayment(int listingId)
    {
        var winningBid = await _dbContext.Bids
            .AsNoTracking()
            .Where(b => b.ListingId == listingId)
            .OrderByDescending(b => b.BidAmount)
            .ThenByDescending(b => b.BidTimestamp)
            .FirstOrDefaultAsync();

        if (winningBid is null)
        {
            return NotFound(new { Message = "No winning bid found for this tender." });
        }

        var pop = await (
            from inv in _dbContext.Invoices.AsNoTracking()
            join proof in _dbContext.ProofOfPayments.AsNoTracking() on inv.InvoiceId equals proof.InvoiceId
            where inv.WinningBidId == winningBid.BidId
            select proof
        ).FirstOrDefaultAsync();

        if (pop is null)
        {
            return NotFound(new { Message = "No proof of payment has been uploaded for this tender." });
        }

        return File(pop.Data, pop.ContentType, pop.FileName);
    }

    /// <summary>
    /// Updates asset and tender details by Listing ID or Asset ID.
    /// PUT /api/admin/tenders/{id} (multipart form; optional image file)
    /// </summary>
    [HttpPut("{id}")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> UpdateTender(int id, [FromForm] UpdateTenderRequestDto dto)
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

        // 4. Optional image replacement — upsert AssetImages (same path as Create)
        if (dto.Image is not null && dto.Image.Length > 0)
        {
            var prepared = await PrepareAssetImageAsync(dto.Image);
            if (prepared.Error is not null)
            {
                return BadRequest(new { message = prepared.Error });
            }

            var existingImage = await _dbContext.AssetImages
                .FirstOrDefaultAsync(i => i.AssetId == asset.AssetId);

            if (existingImage is not null)
            {
                existingImage.ContentType = prepared.ContentType!;
                existingImage.FileName = prepared.FileName!;
                existingImage.Data = prepared.Data!;
                existingImage.UploadedAt = DateTime.UtcNow;
            }
            else
            {
                _dbContext.AssetImages.Add(new AssetImage
                {
                    AssetId = asset.AssetId,
                    ContentType = prepared.ContentType!,
                    FileName = prepared.FileName!,
                    Data = prepared.Data!,
                    UploadedAt = DateTime.UtcNow
                });
            }

            asset.ImageUrl = $"/assets/{asset.AssetId}/image";
        }

        // Force EF Core to mark the entity state as Modified
        _dbContext.Entry(asset).State = EntityState.Modified;

        // 5. Update Tender Listing starting bid if present
        if (listing != null)
        {
            listing.StartingBid = dto.StartingBid;
            _dbContext.Entry(listing).State = EntityState.Modified;
        }

        // 6. Commit and verify rows updated
        int rowsAffected = await _dbContext.SaveChangesAsync();

        if (rowsAffected == 0)
        {
            return StatusCode(500, new { message = "Failed to update database. No records were modified." });
        }

        return Ok(new { message = "Tender details updated successfully.", assetId = asset.AssetId });
    }

    [HttpGet("expired")]
    public async Task<ActionResult<IEnumerable<ExpiredTenderDto>>> GetExpiredTenders()
    {
        var query = @"
        SELECT 
            l.ListingID AS ListingId,
            l.AssetID AS AssetId,
            ISNULL(a.AssetName, 'Untitled Asset') AS AssetName,
            ISNULL(c.CategoryName, 'General') AS CategoryName,
            ISNULL(a.AssetDescription, '') AS Description,
            a.ImageURL AS ImageUrl,
            l.StartingBid AS StartingBid,
            l.StartTime AS StartTime,
            l.EndTime AS EndTime,
            ISNULL(bStats.BidCount, 0) AS BidCount,
            ISNULL(bStats.LeadingBid, l.StartingBid) AS LeadingBid,
            CAST(CASE WHEN ISNULL(bStats.BidCount, 0) > 0 THEN 1 ELSE 0 END AS BIT) AS HasBids,
            CAST(CASE WHEN l.AwardedUserID IS NOT NULL OR l.TenderStatusID IN (8, 9) THEN 1 ELSE 0 END AS BIT) AS IsClosedAsWon,
            CAST(CASE WHEN l.TenderStatusID = 9 OR wb.Status IN ('Paid', 'Claimed', 'Collected') THEN 1 ELSE 0 END AS BIT) AS HasProofOfPayment,
            COALESCE(wb.Status, 
                CASE 
                    WHEN l.TenderStatusID = 8 THEN 'Pending Payment' 
                    WHEN l.TenderStatusID = 9 THEN 'Paid' 
                    ELSE 'Unsold' 
                END
            ) AS PaymentStatus,
            CAST(NULL AS INT) AS InvoiceId,
            ISNULL(wb.Amount, bStats.LeadingBid) AS WinningBidAmount,
            u.Username AS WinnerName
        FROM Tender.Listings l
        LEFT JOIN Assets.Inventory a ON l.AssetID = a.AssetID
        LEFT JOIN Assets.Categories c ON a.CategoryID = c.CategoryID
        LEFT JOIN Security.Users u ON l.AwardedUserID = u.UserID
        LEFT JOIN Tender.WinningBids wb ON wb.UserID = l.AwardedUserID 
            AND wb.LotTitle = COALESCE(a.AssetName, 'Lot #' + CAST(l.ListingID AS VARCHAR))
        OUTER APPLY (
            SELECT COUNT(*) AS BidCount, MAX(b.BidAmount) AS LeadingBid
            FROM Tender.Bids b
            WHERE b.ListingID = l.ListingID
        ) bStats
        WHERE l.EndTime < GETDATE() OR l.TenderStatusID IN (6, 8, 9);";

        var results = await _dbContext.Database
            .SqlQueryRaw<ExpiredTenderDto>(query)
            .ToListAsync();

        return Ok(results);
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
