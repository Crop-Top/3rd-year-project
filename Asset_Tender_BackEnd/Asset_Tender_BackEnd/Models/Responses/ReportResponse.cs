namespace Asset_Tender_BackEnd.Models.Responses;

public class ReportColumn
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public class ReportResponse
{
    public string ReportType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; }
    public string GeneratedBy { get; set; } = string.Empty;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public Dictionary<string, string> Summary { get; set; } = new();
    public List<ReportColumn> Columns { get; set; } = new();
    public List<Dictionary<string, string>> Rows { get; set; } = new();
}
