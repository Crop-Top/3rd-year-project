using System.ComponentModel.DataAnnotations;

namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class InvoiceRequestDto
    {
        [Required]
        public int ListingId { get; set; }

        [Required]
        public string InvoiceType { get; set; } = string.Empty; // "Individual", "VAT Registered Company", "Non-VAT Registered Company"

        public string? CompanyName { get; set; }

        [Required]
        public string ContactPerson { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string ContactEmail { get; set; } = string.Empty;

        public string? VatNumber { get; set; }

        [Required]
        public string Address { get; set; } = string.Empty;

        [Required]
        public string PostalCode { get; set; } = string.Empty;

        [Required]
        public string TelephoneNumber { get; set; } = string.Empty;

        public string? AdditionalInformation { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (InvoiceType == "VAT Registered Company" && string.IsNullOrWhiteSpace(VatNumber))
            {
                yield return new ValidationResult(
                    "VAT number is required for VAT Registered Companies.",
                    new[] { nameof(VatNumber) }
                );
            }

            if (InvoiceType != "Individual" && string.IsNullOrWhiteSpace(CompanyName))
            {
                yield return new ValidationResult(
                    "Company name is required for company invoices.",
                    new[] { nameof(CompanyName) }
                );
            }
        }
    }
}