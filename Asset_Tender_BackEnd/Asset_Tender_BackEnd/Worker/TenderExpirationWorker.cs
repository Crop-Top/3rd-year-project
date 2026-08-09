using Asset_Tender_BackEnd.Models.Data;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Worker
{
    public class TenderExpirationWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TenderExpirationWorker> _logger;

        public TenderExpirationWorker(IServiceProvider serviceProvider, ILogger<TenderExpirationWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // PeriodicTimer fires every 1 minute
            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var dbContext = scope.ServiceProvider.GetRequiredService<Asset_Tender_DBContext>();

                    // Execute the closing stored procedure
                    await dbContext.Database.ExecuteSqlRawAsync("EXEC [Tender].[sp_ProcessExpiredTenders]", stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An error occurred while executing Tender.sp_CloseExpiredTenders.");
                }
            }
        }
    }
}
