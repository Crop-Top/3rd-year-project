using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace Asset_Tender_BackEnd.Models.Requests;

public class CreateTenderRequest
{
    [Required]
    public string AssetName { get; set; } = string.Empty;

    public string? BarcodeSerial { get; set; }

    [Required]
    public int DepartmentID { get; set; }

    public string? DepartmentName { get; set; }

    [Required]
    public int CategoryId { get; set; }

    [Required]
    public string CostCenter { get; set; } = string.Empty;

    [Required]
    public string Location { get; set; } = string.Empty;

    public string? AssetDescription { get; set; }

    [Required]
    public string ConditionGrade { get; set; } = string.Empty;

    public string? ConditionNotes { get; set; }

    public decimal OriginalPurchasePrice { get; set; }

    public decimal StartingBid { get; set; }

    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }

    public IFormFile? Image { get; set; }

    public decimal RecommendedPrice { get; set; }
}
