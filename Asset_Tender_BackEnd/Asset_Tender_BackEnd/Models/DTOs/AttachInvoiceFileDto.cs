namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class AttachInvoiceFileDto
    {
        public IFormFile File { get; set; } = null!;

        public bool SendEmail { get; set; }
    }
}
