using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Services;

public class TenderDeadlineWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TenderDeadlineWorker> _logger;

    public TenderDeadlineWorker(IServiceProvider serviceProvider, ILogger<TenderDeadlineWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<Asset_Tender_DBContext>();
                var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

                // 1. Process regular tender expirations
                await dbContext.Database.ExecuteSqlRawAsync("EXEC [Tender].[sp_ProcessExpiredTenders]", stoppingToken);

                // 2. Process deadline defaults & capture newly escalated Rank 2 winners
                var newWinners = await dbContext.Set<EscalatedAwardNotification>()
                    .FromSqlRaw("EXEC [Tender].[sp_ProcessExpiredAwardDeadlines]")
                    .ToListAsync(stoppingToken);

                // 3. Dispatch emails to new Rank 2 winners with per-item error isolation
                foreach (var winner in newWinners)
                {
                    try
                    {
                        _logger.LogInformation("Escalating Listing #{ListingID} to Rank 2 Bidder: {Email}", winner.ListingID, winner.BidderEmail);

                        await emailService.SendAwardEscalationNotificationAsync(winner.BidderEmail, winner.ListingID, winner.BidAmount);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to send escalation email for Listing #{ListingID} to {Email}", winner.ListingID, winner.BidderEmail);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred during tender deadline worker execution.");
            }

            // Check every minute
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}