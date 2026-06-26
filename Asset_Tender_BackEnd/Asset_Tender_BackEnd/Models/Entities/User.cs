namespace Asset_Tender_BackEnd.Models.Entities
{
    public class User
    {
        public int UserID { get; set; }
        public required string Username { get; set; }
        public required string FullName { get; set; }
        public string? Email { get; set;  }
    }
}
