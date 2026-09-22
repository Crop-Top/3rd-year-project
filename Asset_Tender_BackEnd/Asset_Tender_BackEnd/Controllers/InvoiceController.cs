using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/invoices")]
    public class InvoiceController : ControllerBase
    {
        private readonly Asset_Tender_DBContext _dbContext;
        private readonly IEmailService _emailService;

        public InvoiceController(
            Asset_Tender_DBContext dbContext,
            IEmailService emailService)
        {
            _dbContext = dbContext;
            _emailService = emailService;
        }

        // 1. POST /api/invoices/request - Submit a new invoice request
        [HttpPost("request")]
        [Authorize(Roles = "Admin,SuperAdmin,Bidder,Staff")]
        public async Task<IActionResult> RequestInvoice([FromBody] InvoiceRequestDto dto)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Invalid or missing user ID claim in token." });
            }

            var request = new InvoiceRequest
            {
                ListingId = dto.ListingId,
                UserId = userId,
                InvoiceType = dto.InvoiceType,
                CompanyName = dto.InvoiceType == "Individual" ? null : dto.CompanyName,
                ContactPerson = dto.ContactPerson,
                ContactEmail = dto.ContactEmail,
                VatNumber = dto.InvoiceType == "Non-VAT Registered Company" ? null : dto.VatNumber,
                Address = dto.Address,
                PostalCode = dto.PostalCode,
                TelephoneNumber = dto.TelephoneNumber,
                AdditionalInformation = dto.AdditionalInformation,
                RequestedAt = DateTime.UtcNow,
                Status = "Pending"
            };

            _dbContext.InvoiceRequests.Add(request);
            await _dbContext.SaveChangesAsync();

            return Ok(new { message = "Invoice request submitted successfully.", requestId = request.Id });
        }

        [HttpGet("pending")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> GetPendingInvoices()
        {
            var pendingRequests = await _dbContext.InvoiceRequests
                .Where(r => r.Status == "Pending")
                .GroupJoin(
                    _dbContext.TenderListings.Include(t => t.Asset),
                    req => req.ListingId,
                    listing => listing.ListingId,
                    (req, listings) => new { req, listings }
                )
                .SelectMany(
                    x => x.listings.DefaultIfEmpty(),
                    (x, listing) => new { x.req, listing }
                )
                .GroupJoin(
                    _dbContext.WinningBids,
                    combined => combined.req.ListingId,
                    winningBid => winningBid.ListingId, // Direct ListingID join
                    (combined, winningBids) => new { combined.req, combined.listing, winningBids }
                )
                .SelectMany(
                    x => x.winningBids.DefaultIfEmpty(),
                    (x, winningBid) => new
                    {
                        requestId = x.req.Id,
                        listingId = x.req.ListingId,
                        tenderTitle = winningBid != null && winningBid.LotTitle != null
                            ? winningBid.LotTitle
                            : (x.listing != null && x.listing.Asset != null ? x.listing.Asset.AssetName : $"Listing #{x.req.ListingId}"),
                        referenceNo = winningBid != null && winningBid.SerialNumber != null
                            ? winningBid.SerialNumber
                            : (x.listing != null && x.listing.Asset != null ? x.listing.Asset.BarcodeSerial : $"AST-{x.req.ListingId}"),
                        invoiceType = x.req.InvoiceType,
                        companyName = x.req.CompanyName,
                        contactPerson = x.req.ContactPerson,
                        contactEmail = x.req.ContactEmail,
                        orderNumber = x.req.OrderNumber,
                        vatNumber = x.req.VatNumber,
                        address = x.req.Address,
                        postalCode = x.req.PostalCode,
                        telephoneNumber = x.req.TelephoneNumber,
                        additionalInformation = x.req.AdditionalInformation,
                        requestedAt = x.req.RequestedAt,
                        status = x.req.Status,
                        finalBidAmount = winningBid != null ? winningBid.Amount : (x.listing != null ? x.listing.StartingBid : 0) // Prioritizes WinningBids.Amount
                    }
                )
                .OrderByDescending(r => r.requestedAt)
                .ToListAsync();

            return Ok(pendingRequests);
        }

        [HttpGet("invoiced")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> GetInvoicedInvoices()
        {
            var invoicedRequests = await BuildInvoiceRequestQuery("Invoiced")
                .OrderByDescending(r => r.invoicedAt)
                .ThenByDescending(r => r.requestedAt)
                .ToListAsync();

            return Ok(invoicedRequests);
        }

        // 3. GET /api/invoices/pending-count - Lightweight endpoint for navigation badges
        [HttpGet("pending-count")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> GetPendingCount()
        {
            int count = await _dbContext.InvoiceRequests
                .CountAsync(r => r.Status == "Pending");

            return Ok(new { count });
        }

        [HttpPost("upload-and-send")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadAndSendInvoice([FromForm] UploadInvoiceDto dto)
        {
            if (dto.File == null || dto.File.Length == 0)
                return BadRequest(new { message = "No invoice file provided." });

            var invoiceRequest = await _dbContext.InvoiceRequests.FindAsync(dto.InvoiceRequestId);
            if (invoiceRequest == null)
                return NotFound(new { message = "Invoice request not found." });

            using var memoryStream = new MemoryStream();
            await dto.File.CopyToAsync(memoryStream);
            var fileBytes = memoryStream.ToArray();
            var fileName = string.IsNullOrWhiteSpace(dto.File.FileName)
                ? $"invoice-{invoiceRequest.ListingId}.pdf"
                : Path.GetFileName(dto.File.FileName);
            var contentType = string.IsNullOrWhiteSpace(dto.File.ContentType)
                ? "application/pdf"
                : dto.File.ContentType;

            invoiceRequest.Status = "Invoiced";
            invoiceRequest.InvoiceFileName = fileName;
            invoiceRequest.InvoiceContentType = contentType;
            invoiceRequest.InvoiceData = fileBytes;
            invoiceRequest.InvoicedAt = DateTime.UtcNow;

            if (invoiceRequest.ListingId > 0)
            {
                var listing = await _dbContext.TenderListings.FindAsync(invoiceRequest.ListingId);
                if (listing != null)
                {
                    listing.AwardDeadline = DateTime.UtcNow.AddDays(7);
                }
            }

            await _dbContext.SaveChangesAsync();

            string emailSubject = $"Official Invoice for Tender #{invoiceRequest.ListingId}";
            string emailMessage = "Please find your official tax invoice attached for your recent winning tender.";

            await _emailService.SendInvoiceAsync(
                invoiceRequest.ContactEmail,
                emailSubject,
                emailMessage,
                fileBytes,
                fileName
            );

            return Ok(new { message = "Invoice issued, status updated, and deadline refreshed successfully." });
        }

        [HttpGet("{requestId:int}/file")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> GetInvoiceFile(int requestId)
        {
            var invoiceRequest = await _dbContext.InvoiceRequests
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == requestId);

            if (invoiceRequest is null)
                return NotFound(new { message = "Invoice request not found." });

            if (invoiceRequest.InvoiceData is null || invoiceRequest.InvoiceData.Length == 0)
                return NotFound(new { message = "No invoice file has been stored for this request." });

            var contentType = string.IsNullOrWhiteSpace(invoiceRequest.InvoiceContentType)
                ? "application/pdf"
                : invoiceRequest.InvoiceContentType;
            var fileName = string.IsNullOrWhiteSpace(invoiceRequest.InvoiceFileName)
                ? $"invoice-{invoiceRequest.ListingId}.pdf"
                : invoiceRequest.InvoiceFileName;

            return File(invoiceRequest.InvoiceData, contentType, fileName);
        }

        [HttpPost("{requestId:int}/resend")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> ResendInvoice(int requestId)
        {
            var invoiceRequest = await _dbContext.InvoiceRequests.FindAsync(requestId);
            if (invoiceRequest is null)
                return NotFound(new { message = "Invoice request not found." });

            if (!string.Equals(invoiceRequest.Status, "Invoiced", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Only issued invoices can be resent." });

            if (invoiceRequest.InvoiceData is null || invoiceRequest.InvoiceData.Length == 0)
                return BadRequest(new { message = "No stored invoice file to resend. Attach a PDF first." });

            var fileName = string.IsNullOrWhiteSpace(invoiceRequest.InvoiceFileName)
                ? $"invoice-{invoiceRequest.ListingId}.pdf"
                : invoiceRequest.InvoiceFileName;

            string emailSubject = $"Official Invoice for Tender #{invoiceRequest.ListingId}";
            string emailMessage = "Please find your official tax invoice attached for your recent winning tender.";

            await _emailService.SendInvoiceAsync(
                invoiceRequest.ContactEmail,
                emailSubject,
                emailMessage,
                invoiceRequest.InvoiceData,
                fileName
            );

            return Ok(new
            {
                message = $"Invoice resent successfully to {invoiceRequest.ContactEmail}.",
                contactEmail = invoiceRequest.ContactEmail
            });
        }

        [HttpPost("{requestId:int}/attach")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> AttachInvoiceFile(
            int requestId,
            [FromForm] AttachInvoiceFileDto dto)
        {
            if (dto.File == null || dto.File.Length == 0)
                return BadRequest(new { message = "No invoice file provided." });

            var invoiceRequest = await _dbContext.InvoiceRequests.FindAsync(requestId);
            if (invoiceRequest is null)
                return NotFound(new { message = "Invoice request not found." });

            if (!string.Equals(invoiceRequest.Status, "Invoiced", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Only issued (Invoiced) requests can have a file attached here." });

            using var memoryStream = new MemoryStream();
            await dto.File.CopyToAsync(memoryStream);
            var fileBytes = memoryStream.ToArray();
            var fileName = string.IsNullOrWhiteSpace(dto.File.FileName)
                ? $"invoice-{invoiceRequest.ListingId}.pdf"
                : Path.GetFileName(dto.File.FileName);
            var contentType = string.IsNullOrWhiteSpace(dto.File.ContentType)
                ? "application/pdf"
                : dto.File.ContentType;

            invoiceRequest.InvoiceFileName = fileName;
            invoiceRequest.InvoiceContentType = contentType;
            invoiceRequest.InvoiceData = fileBytes;
            invoiceRequest.InvoicedAt ??= DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            if (dto.SendEmail)
            {
                string emailSubject = $"Official Invoice for Tender #{invoiceRequest.ListingId}";
                string emailMessage = "Please find your official tax invoice attached for your recent winning tender.";

                await _emailService.SendInvoiceAsync(
                    invoiceRequest.ContactEmail,
                    emailSubject,
                    emailMessage,
                    fileBytes,
                    fileName
                );
            }

            return Ok(new
            {
                message = dto.SendEmail
                    ? "Invoice file stored and emailed successfully."
                    : "Invoice file stored successfully.",
                hasInvoiceFile = true,
                fileName
            });
        }

        private IQueryable<InvoiceRequestListItem> BuildInvoiceRequestQuery(string status)
        {
            return _dbContext.InvoiceRequests
                .Where(r => r.Status == status)
                .GroupJoin(
                    _dbContext.TenderListings.Include(t => t.Asset),
                    req => req.ListingId,
                    listing => listing.ListingId,
                    (req, listings) => new { req, listings }
                )
                .SelectMany(
                    x => x.listings.DefaultIfEmpty(),
                    (x, listing) => new { x.req, listing }
                )
                .GroupJoin(
                    _dbContext.WinningBids,
                    combined => combined.req.ListingId,
                    winningBid => winningBid.ListingId,
                    (combined, winningBids) => new { combined.req, combined.listing, winningBids }
                )
                .SelectMany(
                    x => x.winningBids.DefaultIfEmpty(),
                    (x, winningBid) => new InvoiceRequestListItem
                    {
                        requestId = x.req.Id,
                        listingId = x.req.ListingId,
                        tenderTitle = winningBid != null && winningBid.LotTitle != null
                            ? winningBid.LotTitle
                            : (x.listing != null && x.listing.Asset != null
                                ? x.listing.Asset.AssetName
                                : $"Listing #{x.req.ListingId}"),
                        referenceNo = winningBid != null && winningBid.SerialNumber != null
                            ? winningBid.SerialNumber
                            : (x.listing != null && x.listing.Asset != null
                                ? x.listing.Asset.BarcodeSerial
                                : $"AST-{x.req.ListingId}"),
                        invoiceType = x.req.InvoiceType,
                        companyName = x.req.CompanyName,
                        contactPerson = x.req.ContactPerson,
                        contactEmail = x.req.ContactEmail,
                        orderNumber = x.req.OrderNumber,
                        vatNumber = x.req.VatNumber,
                        address = x.req.Address,
                        postalCode = x.req.PostalCode,
                        telephoneNumber = x.req.TelephoneNumber,
                        additionalInformation = x.req.AdditionalInformation,
                        requestedAt = x.req.RequestedAt,
                        status = x.req.Status,
                        finalBidAmount = winningBid != null
                            ? winningBid.Amount
                            : (x.listing != null ? x.listing.StartingBid : 0),
                        hasInvoiceFile = x.req.InvoiceFileName != null,
                        invoicedAt = x.req.InvoicedAt,
                        fileName = x.req.InvoiceFileName
                    }
                );
        }

        private sealed class InvoiceRequestListItem
        {
            public int requestId { get; set; }
            public int listingId { get; set; }
            public string? tenderTitle { get; set; }
            public string? referenceNo { get; set; }
            public string? invoiceType { get; set; }
            public string? companyName { get; set; }
            public string? contactPerson { get; set; }
            public string? contactEmail { get; set; }
            public string? orderNumber { get; set; }
            public string? vatNumber { get; set; }
            public string? address { get; set; }
            public string? postalCode { get; set; }
            public string? telephoneNumber { get; set; }
            public string? additionalInformation { get; set; }
            public DateTime requestedAt { get; set; }
            public string? status { get; set; }
            public decimal finalBidAmount { get; set; }
            public bool hasInvoiceFile { get; set; }
            public DateTime? invoicedAt { get; set; }
            public string? fileName { get; set; }
        }
    }
}
