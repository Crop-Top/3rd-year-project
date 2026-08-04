namespace Asset_Tender_BackEnd.Models.Responses;

public class CategoryLookupResponse
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
}

public class DepartmentLookupResponse
{
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
}
