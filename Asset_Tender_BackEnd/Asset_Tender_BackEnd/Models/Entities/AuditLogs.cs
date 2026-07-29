namespace Asset_Tender_BackEnd.Models.Entities
{
    public class AuditLogs
    {
        public int AuditLogID { get; set; }

        public int UserID { get; set; }

        public int AuditActionID { get; set; }

        public string TableName { get; set; } = null!;

        public int RecordID { get; set; }

        public string? ChangeDetails { get; set; }

        public DateTime Timestamp { get; set; }
    }
}
