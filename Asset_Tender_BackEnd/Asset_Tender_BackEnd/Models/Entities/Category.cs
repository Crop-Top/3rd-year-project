using System;
using System.Collections.Generic;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class Category
{
    public int CategoryId { get; set; }

    public int ParentCategoryID { get; set; }

    public string CategoryName { get; set; } = null!;

    public string CategoryCode { get; set; } = null!;
    
    public string Description { get; set; } = null!;

    public int DisplayOrder {  get; set; }

    public int IsActive { get; set; }

    public DateTime CreatedDate { get; set; }

    public virtual ICollection<Inventory> Assets { get; set; } = new List<Inventory>();

    public virtual ICollection<Category> InverseParentCategory { get; set; } = new List<Category>();

    public virtual Category? ParentCategory { get; set; }
}
