namespace Asset_Tender_BackEnd.Models.Entities;

public class AssetImage
{
    public int AssetImageId { get; set; }

    public int AssetId { get; set; }

    public string ContentType { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public byte[] Data { get; set; } = null!;

    public DateTime UploadedAt { get; set; }

    public virtual Inventory Asset { get; set; } = null!;
}
