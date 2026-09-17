using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Asset_Tender_BackEnd.Models.Entities
{
    public class WinningBid
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)] // Tells EF Core NOT to generate auto-increment values
        public int BidId { get; set; }

        public int UserId { get; set; }
        public string LotTitle { get; set; }
        public string? SerialNumber { get; set; }
        public decimal Amount { get; set; }
        public DateTimeOffset WonDate { get; set; }
        public string? Status { get; set; }
        public string? ImageUrl { get; set; }
        public int? ListingId { get; set; }
    }
}
