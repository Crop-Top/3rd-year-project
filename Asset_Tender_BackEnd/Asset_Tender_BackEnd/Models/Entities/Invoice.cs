using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class Invoice
{
    public int InvoiceId { get; set; }

    public int WinningBidId { get; set; }

    public int BuyerId { get; set; }

    public decimal TotalAmount { get; set; }

    public string PaymentStatus { get; set; } = null!;

    public int? ReleasedBy { get; set; }

    public DateTime? ReleaseDate { get; set; }

    public string? ProofOfPaymentUrl { get; set; }

    public virtual User Buyer { get; set; } = null!;

    public virtual User? ReleasedByNavigation { get; set; }

    public virtual Bid WinningBid { get; set; } = null!;
}
