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

    public string? CostCenter { get; set; }

    public string? Location { get; set; }

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

    /// <summary>Optional on-site viewing start date/time. Null when the lot has no scheduled viewing.</summary>
    public DateTime? ViewingDate { get; set; }

    /// <summary>Optional viewing end date/time.</summary>
    public DateTime? ViewingEndTime { get; set; }

    /// <summary>Optional viewing location/venue (required by UI when ViewingDate is set).</summary>
    public string? ViewingLocation { get; set; }

    public IFormFile? Image { get; set; }

    public decimal RecommendedPrice { get; set; }
}
