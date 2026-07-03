using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class SystemDocument
{
    public int DocumentId { get; set; }

    public string DocumentName { get; set; } = null!;

    public string Category { get; set; } = null!;

    public string FileUrl { get; set; } = null!;

    public DateTime UploadDate { get; set; }

    public int UploadedBy { get; set; }

    public virtual User UploadedByNavigation { get; set; } = null!;
}
