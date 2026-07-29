namespace Asset_Tender_BackEnd.Models.Entities
{
    public class UserSessions
    {
        public int SessionID { get; set; }

        public int UserID { get; set; }

        public string RefreshToken { get; set; } = null!;

        public string JwtIdentifier { get; set; } = null!;

        public string? DeviceDetails { get; set; }

        public string? IpAddress { get; set; }

        public bool IsRevoked { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime ExpiryDate { get; set; }
    }
}
