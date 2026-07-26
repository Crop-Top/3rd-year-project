namespace Asset_Tender_BackEnd.Models.Entities;

public class AssetStatus
{
    public int AssetStatusId { get; set; }

    public string StatusName { get; set; } = null!;

    public string? Description { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }
}
