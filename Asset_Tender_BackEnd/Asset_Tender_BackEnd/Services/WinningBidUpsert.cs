using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Services;

/// <summary>
/// Upserts Tender.WinningBids. Campus BidID is IDENTITY, but the app keys rows by Bids.BidID,
/// so inserts must briefly enable IDENTITY_INSERT on the same connection/transaction.
/// </summary>
public static class WinningBidUpsert
{
    public static async Task UpsertAsync(
        Asset_Tender_DBContext db,
        int bidId,
        int userId,
        string lotTitle,
        string? serialNumber,
        decimal amount,
        DateTimeOffset wonDate,
        string status,
        string? imageUrl,
        CancellationToken cancellationToken = default)
    {
        var existing = await db.WinningBids
            .FirstOrDefaultAsync(w => w.BidId == bidId, cancellationToken);

        if (existing is not null)
        {
            existing.UserId = userId;
            existing.LotTitle = lotTitle;
            existing.SerialNumber = serialNumber ?? string.Empty;
            existing.Amount = amount;
            existing.Status = status;
            existing.ImageUrl = imageUrl ?? string.Empty;
            return;
        }

        db.WinningBids.Add(new WinningBid
        {
            BidId = bidId,
            UserId = userId,
            LotTitle = lotTitle,
            SerialNumber = serialNumber ?? string.Empty,
            Amount = amount,
            WonDate = wonDate,
            Status = status,
            ImageUrl = imageUrl ?? string.Empty
        });
    }

    /// <summary>
    /// Saves tracked changes, enabling IDENTITY_INSERT when a new WinningBids row is pending insert.
    /// </summary>
    public static async Task SaveChangesAllowingWinningBidIdentityAsync(
        Asset_Tender_DBContext db,
        CancellationToken cancellationToken = default)
    {
        var insertingWinningBid = db.ChangeTracker.Entries<WinningBid>()
            .Any(e => e.State == EntityState.Added);

        if (!insertingWinningBid)
        {
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            "SET IDENTITY_INSERT [Tender].[WinningBids] ON",
            cancellationToken);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        finally
        {
            await db.Database.ExecuteSqlRawAsync(
                "SET IDENTITY_INSERT [Tender].[WinningBids] OFF",
                cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }
}
