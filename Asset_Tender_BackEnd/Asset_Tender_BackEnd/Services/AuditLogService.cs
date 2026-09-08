using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Services;

public class AuditLogService : IAuditLogService
{
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(Asset_Tender_DBContext dbContext, ILogger<AuditLogService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task TryLogAsync(
        int userId,
        string actionName,
        string tableName,
        int recordId,
        string? changeDetails = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var action = await _dbContext.AuditActions
                .FirstOrDefaultAsync(a => a.ActionName == actionName, cancellationToken);

            if (action is null)
            {
                action = new AuditAction
                {
                    ActionName = actionName,
                    Description = actionName
                };
                _dbContext.AuditActions.Add(action);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            _dbContext.AuditLogs.Add(new AuditLogs
            {
                UserID = userId,
                AuditActionID = action.AuditActionID,
                TableName = tableName,
                RecordID = recordId,
                ChangeDetails = changeDetails,
                Timestamp = DateTime.UtcNow
            });

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Audit log write skipped for {Action} on {Table}#{RecordId}.", actionName, tableName, recordId);
        }
    }
}
