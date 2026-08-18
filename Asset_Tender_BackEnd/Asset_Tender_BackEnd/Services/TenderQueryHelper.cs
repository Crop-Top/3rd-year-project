using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Services;

public static class TenderQueryHelper
{
    public static IQueryable<TenderListItemResponse> ProjectListings(Asset_Tender_DBContext db)
    {
        return
            from listing in db.TenderListings.AsNoTracking()
            join asset in db.Assets.AsNoTracking() on listing.AssetId equals asset.AssetId
            join category in db.Categories.AsNoTracking() on asset.CategoryId equals category.CategoryId
            // REMOVED: join department in db.Departments ...
            join condition in db.AssetConditions.AsNoTracking() on asset.AssetConditionId equals condition.AssetConditionId
            join assetStatus in db.AssetStatuses.AsNoTracking() on asset.AssetStatusId equals assetStatus.AssetStatusId
            join tenderStatus in db.TenderStatuses.AsNoTracking() on listing.TenderStatusId equals tenderStatus.TenderStatusId
            let bidCount = db.Bids.Count(b => b.ListingId == listing.ListingId)
            select new TenderListItemResponse
            {
                ListingId = listing.ListingId,
                AssetId = asset.AssetId,
                AssetName = asset.AssetName,
                BarcodeSerial = asset.BarcodeSerial,
                CategoryName = category.CategoryName,
                // Assign DepartmentID string/int or handle mapping via your External API Service
                DepartmentName = asset.DepartmentID.ToString(),
                ConditionName = condition.ConditionName,
                Description = asset.ConditionNotes ?? asset.AssetDescription,
                StartingBid = listing.StartingBid,
                LeadingBid = db.Bids
                    .Where(b => b.ListingId == listing.ListingId)
                    .Select(b => (decimal?)b.BidAmount)
                    .Max() ?? listing.StartingBid,
                RecommendedPrice = asset.ReccomendedPrice,
                ImageUrl = asset.ImageUrl,
                StartTime = listing.StartTime,
                EndTime = listing.EndTime,
                AssetStatusName = assetStatus.StatusName,
                TenderStatusName = tenderStatus.StatusName,
                IsActive = listing.IsActive,
                BidCount = bidCount,
                HasBids = bidCount > 0
            };
    }

    public static IQueryable<TenderListItemResponse> Pending(Asset_Tender_DBContext db) =>
        ProjectListings(db).Where(t =>
            t.TenderStatusName == UserConstants.TenderStatusPending &&
            t.AssetStatusName == UserConstants.AssetStatusPending);

    public static IQueryable<TenderListItemResponse> LiveForStaff(Asset_Tender_DBContext db)
    {
        var now = DateTime.UtcNow;
        return ProjectListings(db).Where(t =>
            t.IsActive &&
            t.TenderStatusName == UserConstants.TenderStatusOpen &&
            t.AssetStatusName == UserConstants.AssetStatusActive &&
            t.EndTime > now);
    }

    public static IQueryable<TenderListItemResponse> ExpiredForAdmin(Asset_Tender_DBContext db)
    {
        var now = DateTime.UtcNow;
        return ProjectListings(db).Where(t =>
            t.IsActive &&
            t.TenderStatusName == UserConstants.TenderStatusOpen &&
            t.AssetStatusName == UserConstants.AssetStatusActive &&
            t.EndTime <= now);
    }

    public static IQueryable<TenderListItemResponse> ForBidderVisibility(
        IQueryable<TenderListItemResponse> query,
        string? role)
    {
        if (CategoryAccessHelper.IsBidderRole(role))
        {
            return query.Where(t =>
                t.CategoryName.ToLower() == CategoryAccessHelper.VehiclesCategoryName.ToLower());
        }

        return query;
    }

    /// <summary>
    /// Attaches the viewer's own offer and seals competitive fields for non-admin viewers
    /// while the lot is still open.
    /// </summary>
    public static async Task ApplyViewerOfferAndSealAsync(
        Asset_Tender_DBContext db,
        IList<TenderListItemResponse> items,
        int? viewerUserId,
        bool revealCompetitiveBids,
        CancellationToken cancellationToken = default)
    {
        if (items.Count == 0)
        {
            return;
        }

        var now = DateTime.UtcNow;
        Dictionary<int, decimal>? myOffers = null;

        if (viewerUserId is int userId)
        {
            var listingIds = items.Select(i => i.ListingId).Distinct().ToList();
            var rows = await db.Bids
                .AsNoTracking()
                .Where(b => b.BidderId == userId && listingIds.Contains(b.ListingId))
                .GroupBy(b => b.ListingId)
                .Select(g => new { ListingId = g.Key, Amount = g.Max(x => x.BidAmount) })
                .ToListAsync(cancellationToken);

            myOffers = rows.ToDictionary(x => x.ListingId, x => x.Amount);
        }

        foreach (var item in items)
        {
            if (myOffers is not null && myOffers.TryGetValue(item.ListingId, out var amount))
            {
                item.MyOfferAmount = amount;
                item.HasSubmittedOffer = true;
            }
            else
            {
                item.MyOfferAmount = null;
                item.HasSubmittedOffer = false;
            }

            if (!revealCompetitiveBids && item.EndTime > now)
            {
                item.LeadingBid = item.StartingBid;
                item.BidCount = item.HasSubmittedOffer ? 1 : 0;
                item.HasBids = item.HasSubmittedOffer;
            }
        }
    }
}
