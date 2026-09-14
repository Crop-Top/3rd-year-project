namespace Asset_Tender_BackEnd.Models.DTOs
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
}
