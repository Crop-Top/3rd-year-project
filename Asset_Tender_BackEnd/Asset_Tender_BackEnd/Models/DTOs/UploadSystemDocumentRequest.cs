using Microsoft.AspNetCore.Http;

namespace Asset_Tender_BackEnd.Models.DTOs;

/// <summary>Multipart form body for system document uploads (Swashbuckle 10 requires IFormFile inside a model).</summary>
public class UploadSystemDocumentRequest
{
    public IFormFile? File { get; set; }

    public string? DocumentName { get; set; }

    public int DocumentCategoryId { get; set; }

    public bool VisibleToInternal { get; set; }

    public bool VisibleToExternal { get; set; }
}
