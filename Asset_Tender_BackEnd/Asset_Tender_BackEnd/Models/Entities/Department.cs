using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class Department
{
    public int DepartmentID { get; set; }

    public string DepartmentName { get; set; } = null!;

    public string DepartmentCode { get; set; } = null!;

    public string Description { get; set; } = null!;

    public int IsActive { get; set; }

    public DateTime CreatedDate { get; set; }

    public virtual ICollection<Inventory> Assets { get; set; } = new List<Inventory>();
}
