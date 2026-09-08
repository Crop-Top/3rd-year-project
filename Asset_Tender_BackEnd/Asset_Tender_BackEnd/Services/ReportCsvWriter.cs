using System.Text;
using Asset_Tender_BackEnd.Models.Responses;

namespace Asset_Tender_BackEnd.Services;

public static class ReportCsvWriter
{
    public static byte[] ToBytes(ReportResponse report)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", report.Columns.Select(c => Escape(c.Label))));

        foreach (var row in report.Rows)
        {
            var cells = report.Columns.Select(col =>
            {
                row.TryGetValue(col.Key, out var value);
                return Escape(value ?? string.Empty);
            });
            sb.AppendLine(string.Join(",", cells));
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string Escape(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
}
