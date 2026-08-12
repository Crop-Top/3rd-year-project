namespace Asset_Tender_BackEnd.Models.Entities;

public class PaymentStatus
{
    public int PaymentStatusId { get; set; }

    public string StatusName { get; set; } = null!;

    public string? Description { get; set; }

    public int DisplayOrder { get; set; }

    public virtual ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}
