using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Asset_Tender_BackEnd.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/invoices")]
    public class InvoiceController : ControllerBase
    {
        private readonly Asset_Tender_DBContext _dbContext;
        private readonly IEmailService _emailService;
        private readonly IWebHostEnvironment _env;

        public InvoiceController(
            Asset_Tender_DBContext dbContext,
            IEmailService emailService,
            IWebHostEnvironment env)
        {
            _dbContext = dbContext;
            _emailService = emailService;
            _env = env;
        }

        // 1. POST /api/invoices/request - Submit a new invoice request
        [HttpPost("request")]
        public async Task<IActionResult> RequestInvoice([FromBody] InvoiceRequestDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
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
                OrderNumber = dto.OrderNumber,
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
        public async Task<IActionResult> UploadAndSendInvoice([FromForm] UploadInvoiceDto dto)
        {
            // 👇 Using dto.File
            if (dto.File == null || dto.File.Length == 0)
                return BadRequest(new { message = "No invoice file provided." });

            // 👇 Using dto.InvoiceRequestId
            var invoiceRequest = await _dbContext.InvoiceRequests.FindAsync(dto.InvoiceRequestId);
            if (invoiceRequest == null)
                return NotFound(new { message = "Invoice request not found." });

            // Update status to 'Invoiced'
            invoiceRequest.Status = "Invoiced";

            // Reset AwardDeadline for a fresh 7-day window
            if (invoiceRequest.ListingId > 0)
            {
                var listing = await _dbContext.TenderListings.FindAsync(invoiceRequest.ListingId);
                if (listing != null)
                {
                    listing.AwardDeadline = DateTime.UtcNow.AddDays(7);
                }
            }

            await _dbContext.SaveChangesAsync();

            // Read file bytes into memory using dto.File
            using var memoryStream = new MemoryStream();
            await dto.File.CopyToAsync(memoryStream);
            var fileBytes = memoryStream.ToArray();
            var fileName = dto.File.FileName;

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
    }
}