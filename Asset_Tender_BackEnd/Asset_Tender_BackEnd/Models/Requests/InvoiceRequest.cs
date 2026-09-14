using System.ComponentModel.DataAnnotations;

namespace Asset_Tender_BackEnd.Models.Requests
{
    public class InvoiceRequest
    {
        [Key]
        public int Id { get; set; }

        public int ListingId { get; set; }

        public int UserId { get; set; }

        [Required]
        [MaxLength(50)]
        public string InvoiceType { get; set; } = string.Empty; // "Individual", "VAT Registered Company", "Non-VAT Registered Company"

        [MaxLength(200)]
        public string? CompanyName { get; set; }

        [Required]
        [MaxLength(150)]
        public string ContactPerson { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string ContactEmail { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? OrderNumber { get; set; }

        [MaxLength(50)]
        public string? VatNumber { get; set; }

        [Required]
        public string Address { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string PostalCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string TelephoneNumber { get; set; } = string.Empty;

        public string? AdditionalInformation { get; set; }

        public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    }
}
