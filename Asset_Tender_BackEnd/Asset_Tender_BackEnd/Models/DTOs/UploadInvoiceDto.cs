namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class UploadInvoiceDto
    {
        public int InvoiceRequestId { get; set; }
        public IFormFile File { get; set; } = null!;
    }
}