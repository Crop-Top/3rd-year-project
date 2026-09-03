using System.ComponentModel.DataAnnotations;

namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class RetractTenderDto
    {
        [Required(ErrorMessage = "A reason for retracting or cancelling the tender is required.")]
        [StringLength(500, ErrorMessage = "The cancellation reason cannot exceed 500 characters.")]
        public string Reason { get; set; } = string.Empty;
    }
}
