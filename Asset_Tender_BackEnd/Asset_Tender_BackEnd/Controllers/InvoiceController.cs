using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace YourProject.Controllers
{
    public class InvoiceRequestDto
    {
        public int ListingId { get; set; }
        public string InvoiceType { get; set; } = string.Empty;
        public string? CompanyName { get; set; }
        public string ContactPerson { get; set; } = string.Empty;
        public string ContactEmail { get; set; } = string.Empty;
        public string? OrderNumber { get; set; }
        public string? VatNumber { get; set; }
        public string Address { get; set; } = string.Empty;
        public string PostalCode { get; set; } = string.Empty;
        public string TelephoneNumber { get; set; } = string.Empty;
        public string? AdditionalInformation { get; set; }
    }

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class InvoiceController : ControllerBase
    {
        private readonly Asset_Tender_DBContext _dbContext;

        public InvoiceController(Asset_Tender_DBContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpPost("request")]
        public async Task<IActionResult> RequestInvoice([FromBody] InvoiceRequestDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
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
                RequestedAt = DateTime.UtcNow
            };

            _dbContext.InvoiceRequests.Add(request);
            await _dbContext.SaveChangesAsync();

            return Ok(new { message = "Invoice request submitted successfully.", requestId = request.Id });
        }
    }
}