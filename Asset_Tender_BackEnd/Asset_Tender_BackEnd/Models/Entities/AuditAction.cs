namespace Asset_Tender_BackEnd.Models.Entities
{
    public class AuditAction
    {
        public int AuditActionID { get; set; }

        public string ActionName { get; set; } = null!;

        public string Description { get; set; } = null!;
    }
}
