using System.ComponentModel.DataAnnotations;

namespace Asset_Tender_BackEnd.Models.Requests;

public class PlaceBidRequest
{
    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Bid amount must be greater than zero.")]
    public decimal Amount { get; set; }
}
