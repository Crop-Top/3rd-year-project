namespace Asset_Tender_BackEnd.Models.Entities;

public class AssetCondition
{
    public int AssetConditionId { get; set; }

    public string ConditionName { get; set; } = null!;

    public string? Description { get; set; }

    public int DisplayOrder { get; set; }
}
