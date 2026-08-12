using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class Invoice
{
    public int InvoiceId { get; set; }

    public string InvoiceNumber { get; set; } = null!;

    public int WinningBidId { get; set; }

    public int BuyerId { get; set; }

    public decimal TotalAmount { get; set; }

    public int PaymentStatusId { get; set; }

    public int? ReleasedBy { get; set; }

    public DateTime? ReleaseDate { get; set; }

    public string? ProofOfPaymentUrl { get; set; }

    public virtual User Buyer { get; set; } = null!;

    public virtual User? ReleasedByNavigation { get; set; }

    public virtual Bid WinningBid { get; set; } = null!;

    public virtual PaymentStatus PaymentStatus { get; set; } = null!;

    public virtual ProofOfPayment? ProofOfPayment { get; set; }
}
