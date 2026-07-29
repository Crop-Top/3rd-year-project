namespace Asset_Tender_BackEnd.Models.Entities
{
    public class IdentityProviders
    {
        public int IdentityProviderID { get; set; }

        public string ProviderName { get; set; } = null!; 
        
        public string Description { get; set; } = null!;

        public int IsActive { get; set; }

        public DateTime CreatedDate { get; set; }
    }
}
