using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Asset_Tender_BackEnd.Controllers;

/// <summary>
/// Standalone SuperAdmin Proof of Payment upload/download for closed-as-won tenders.
/// Stores files on Tender.ProofOfPayment linked via Invoice.WinningBidId.
/// </summary>
[ApiController]
[Route("api/admin/proof-of-payment")]
[Authorize(Roles = "SuperAdmin")]
public class ProofOfPaymentController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IAuditLogService _auditLogService;

    public ProofOfPaymentController(Asset_Tender_DBContext dbContext, IAuditLogService auditLogService)
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

    private async Task<List<int>> GetWonTenderStatusIdsAsync()
    {
        return await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == UserConstants.TenderStatusClosed
                     || s.StatusName == UserConstants.TenderStatusAwarded)
            .Select(s => s.TenderStatusId)
            .ToListAsync();
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
    /// POST /api/admin/proof-of-payment/{listingId}
    /// </summary>
    [HttpPost("{listingId:int}")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Upload(int listingId, [FromForm] UploadProofOfPaymentRequest request)
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

        var wonStatusIds = await GetWonTenderStatusIdsAsync();
        var collectedStatusIds = await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == "Collected" || s.TenderStatusId == TenderStatuses.Collected)
            .Select(s => s.TenderStatusId)
            .ToListAsync();

        var listing = await _dbContext.TenderListings
            .FirstOrDefaultAsync(l => l.ListingId == listingId);

        if (listing is null)
        {
            return NotFound(new { Message = "Tender listing not found." });
        }

        var blockedStatusIds = await _dbContext.TenderStatuses
            .AsNoTracking()
            .Where(s => s.StatusName == UserConstants.TenderStatusCancelled
                     || s.StatusName == UserConstants.TenderStatusRejected
                     || s.StatusName == UserConstants.TenderStatusPending)
            .Select(s => s.TenderStatusId)
            .ToListAsync();

        var eligibleForPop =
            wonStatusIds.Contains(listing.TenderStatusId)
            || collectedStatusIds.Contains(listing.TenderStatusId)
            || (!listing.IsActive && !blockedStatusIds.Contains(listing.TenderStatusId));

        if (!eligibleForPop)
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

        var pendingPopStatus = await _dbContext.PaymentStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.PaymentStatusPendingPop);
        var verifiedStatus = await _dbContext.PaymentStatuses
            .FirstOrDefaultAsync(s => s.StatusName == UserConstants.PaymentStatusVerified);
        if (verifiedStatus is null)
        {
            return StatusCode(500, new { Message = "Payment status 'Verified' is not configured." });
        }

        if (invoice is null)
        {
            if (pendingPopStatus is null)
            {
                return StatusCode(500, new { Message = "Payment status 'Pending POP' is not configured." });
            }

            invoice = new Invoice
            {
                InvoiceNumber = $"INV-{listingId}-{winningBid.BidId}",
                WinningBidId = winningBid.BidId,
                BuyerId = winningBid.BidderId,
                TotalAmount = winningBid.BidAmount,
                PaymentStatusId = pendingPopStatus.PaymentStatusId,
                ReleasedBy = GetCurrentUserId(),
                ReleaseDate = DateTime.UtcNow
            };
            _dbContext.Invoices.Add(invoice);
            await _dbContext.SaveChangesAsync();
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
        invoice.ProofOfPaymentUrl = $"/api/admin/proof-of-payment/{listingId}";

        // Mirror paid state on Tender.WinningBids.Status (existing field — no schema change).
        var asset = listing.Asset ?? await _dbContext.Assets
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.AssetId == listing.AssetId);

        await WinningBidUpsert.UpsertAsync(
            _dbContext,
            bidId: winningBid.BidId,
            userId: winningBid.BidderId,
            lotTitle: asset?.AssetName ?? $"Lot #{listingId}",
            serialNumber: asset?.BarcodeSerial,
            amount: winningBid.BidAmount,
            wonDate: DateTimeOffset.UtcNow,
            status: "Paid",
            imageUrl: asset?.ImageUrl);

        await WinningBidUpsert.SaveChangesAllowingWinningBidIdentityAsync(_dbContext);

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
    /// GET /api/admin/proof-of-payment/{listingId}
    /// </summary>
    [HttpGet("{listingId:int}")]
    public async Task<IActionResult> Download(int listingId)
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
}
