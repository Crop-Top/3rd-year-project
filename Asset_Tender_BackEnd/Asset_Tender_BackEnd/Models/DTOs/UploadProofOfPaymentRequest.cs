using Microsoft.AspNetCore.Http;

namespace Asset_Tender_BackEnd.Models.DTOs;

/// <summary>Multipart form body for SuperAdmin Proof of Payment upload.</summary>
public class UploadProofOfPaymentRequest
{
    /// <summary>PDF proof of payment file (form field name: file).</summary>
    public IFormFile? File { get; set; }
}
