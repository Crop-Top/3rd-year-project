namespace Asset_Tender_BackEnd.Models.Responses;

public class DocumentListItemResponse
{
    public int DocumentId { get; set; }
    public string DocumentName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public DateTime UploadDate { get; set; }
    public bool VisibleToInternal { get; set; }
    public bool VisibleToExternal { get; set; }
    public string? UploadedByName { get; set; }
}
