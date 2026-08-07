using Microsoft.Data.SqlClient;
namespace Asset_Tender_BackEnd.Services
{
    public class TenderClosingWorker : BackgroundService
    {
        private readonly string _connectionString;
        private readonly ILogger<TenderClosingWorker> _logger;

        public TenderClosingWorker(IConfiguration configuration, ILogger<TenderClosingWorker> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Tender Settlement Engine Started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessExpiredTendersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while settling expired tenders.");
                }

                // Poll every 1 minute
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task ProcessExpiredTendersAsync()
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = new SqlCommand("[Tender].[sp_ProcessExpiredTenders]", conn)
            {
                CommandType = System.Data.CommandType.StoredProcedure
            };

            await cmd.ExecuteNonQueryAsync();
        }
    }
}
