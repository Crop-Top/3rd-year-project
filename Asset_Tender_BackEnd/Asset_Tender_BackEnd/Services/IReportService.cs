using Asset_Tender_BackEnd.Models.Responses;

namespace Asset_Tender_BackEnd.Services;

public interface IReportService
{
    Task<ReportResponse> GenerateAsync(
        string reportType,
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken = default);
}
