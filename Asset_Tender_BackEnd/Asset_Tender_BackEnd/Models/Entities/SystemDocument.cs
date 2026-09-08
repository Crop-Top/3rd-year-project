using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class SystemDocument
{
    public int DocumentId { get; set; }

    public string DocumentName { get; set; } = null!;

    public string DocumentCategoryID { get; set; } = null!;

    public string FileUrl { get; set; } = null!;

    public int UploadedBy { get; set; }

    public DateTime UploadDate { get; set; }

    /// <summary>Visible to Staff, Admin, and SuperAdmin.</summary>
    public bool VisibleToInternal { get; set; } = true;

    /// <summary>Visible to external Bidder accounts.</summary>
    public bool VisibleToExternal { get; set; }

    public virtual User UploadedByNavigation { get; set; } = null!;
}
