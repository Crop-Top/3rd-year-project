using System.ComponentModel.DataAnnotations;

namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class CancelTenderRequestDto
    {
        [Required(ErrorMessage = "A cancellation reason is required.")]
        [StringLength(500, ErrorMessage = "Reason cannot exceed 500 characters.")]
        public string Reason { get; set; } = string.Empty;
    }
}
