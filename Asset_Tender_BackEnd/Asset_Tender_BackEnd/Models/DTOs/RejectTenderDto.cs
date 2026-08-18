using System.Text.Json.Serialization;

namespace Asset_Tender_BackEnd.Models.DTOs
{
    public class RejectTenderDto
    {
        [JsonPropertyName("reason")]
        public string? Reason { get; set; }
    }
}