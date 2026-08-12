namespace Asset_Tender_BackEnd.Models.Entities;

public class ProofOfPayment
{
    public int ProofOfPaymentId { get; set; }

    public int InvoiceId { get; set; }

    public string ContentType { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public byte[] Data { get; set; } = null!;

    public DateTime UploadedAt { get; set; }

    public virtual Invoice Invoice { get; set; } = null!;
}
