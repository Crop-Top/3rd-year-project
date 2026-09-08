namespace Asset_Tender_BackEnd.Services;

public interface IAuditLogService
{
    Task TryLogAsync(
        int userId,
        string actionName,
        string tableName,
        int recordId,
        string? changeDetails = null,
        CancellationToken cancellationToken = default);
}
