namespace Asset_Tender_BackEnd.Models.Entities
{
    public class PaymentStatus
    {
        public int PaymentStatusID { get; set; }

        public string StatusName { get; set; } = null!;

        public string Description { get; set; } = null!;

        public int DisplayOrder { get; set; }
    }
}
