namespace Asset_Tender_BackEnd.Models.Entities;

public class TenderStatus
{
    public int TenderStatusId { get; set; }

    public string StatusName { get; set; } = null!;

    public string? Description { get; set; }

    public int DisplayOrder { get; set; }
}
