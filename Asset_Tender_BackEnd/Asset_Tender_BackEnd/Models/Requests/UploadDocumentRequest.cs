namespace Asset_Tender_BackEnd.Models.Requests
{
    public class UploadDocumentRequest
    {
        public IFormFile? File { get; set; }
        public string? DocumentName { get; set; }
        public string? Category { get; set; }
        public bool VisibleToInternal { get; set; } = false;
        public bool VisibleToExternal { get; set; } = false;
    }
}
