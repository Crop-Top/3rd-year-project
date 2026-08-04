using System.ComponentModel.DataAnnotations;

namespace Asset_Tender_BackEnd.Models.Requests;

public class DisposeTenderRequest
{
    /// <summary>
    /// Must be "Donation" or "Scrap".
    /// </summary>
    [Required]
    public string Disposition { get; set; } = string.Empty;
}
