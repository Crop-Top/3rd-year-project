using System.ComponentModel.DataAnnotations;

namespace Asset_Tender_BackEnd.Models.Requests;

public class RelistTenderRequest
{
    [Required]
    public DateTime EndTime { get; set; }
}
