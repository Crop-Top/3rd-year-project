namespace Asset_Tender_BackEnd.Models.Entities
{
    public class DocumentCategory
    {
        public int DocumentCategoryId { get; set; }

        public string CategoryName { get; set; } = null!;

        public string Description { get; set; } = null!;

        public int DisplayOrder { get; set; }
    }
}
