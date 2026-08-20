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
            join asset in db.Assets.AsNoTracking()
                on listing.AssetId equals asset.AssetId

            join category in db.Categories.AsNoTracking()
                on asset.CategoryId equals category.CategoryId into catGroup
            from category in catGroup.DefaultIfEmpty()

            join condition in db.AssetConditions.AsNoTracking()
                on asset.AssetConditionId equals condition.AssetConditionId into condGroup
            from condition in condGroup.DefaultIfEmpty()

            join assetStatus in db.AssetStatuses.AsNoTracking()
                on asset.AssetStatusId equals assetStatus.AssetStatusId into astGroup
            from assetStatus in astGroup.DefaultIfEmpty()

            join tenderStatus in db.TenderStatuses.AsNoTracking()
                on listing.TenderStatusId equals tenderStatus.TenderStatusId into tndGroup
            from tenderStatus in tndGroup.DefaultIfEmpty()

            join uploader in db.Users.AsNoTracking()
                on asset.UploadedBy equals uploader.UserId into upGroup
            from uploader in upGroup.DefaultIfEmpty()

            let bidCount = db.Bids.Count(b => b.ListingId == listing.ListingId)

            select new TenderListItemResponse
            {
                ListingId = listing.ListingId,
                AssetId = asset.AssetId,
                AssetName = asset.AssetName ?? "N/A",
                BarcodeSerial = asset.BarcodeSerial ?? "N/A",
                CategoryId = asset.CategoryId,
                CategoryName = category != null ? category.CategoryName : "N/A",

                // Preserved DepartmentID for API enrichment helper
                DepartmentID = asset.DepartmentID,

                // Hold stored department name/code temporarily
                DepartmentName = !string.IsNullOrWhiteSpace(asset.DepartmentName)
                    ? asset.DepartmentName
                    : null,

                CostCenter = asset.CostCenter ?? "N/A",
                Location = asset.Location ?? "N/A",
                Description = asset.AssetDescription ?? "No description provided.",
                ConditionNotes = asset.ConditionNotes ?? "No condition notes.",
                ConditionName = condition != null ? condition.ConditionName : "N/A",
                ImageUrl = asset.ImageUrl,
                RecommendedPrice = asset.ReccomendedPrice,
                AssetStatusName = assetStatus != null ? assetStatus.StatusName : "N/A",

                UploadedBy = uploader != null
                    ? (!string.IsNullOrWhiteSpace(uploader.FullName)
                        ? uploader.FullName.Trim()
                        : uploader.Username)
                    : "N/A",

                StartingBid = listing.StartingBid,
                LeadingBid = db.Bids
                    .Where(b => b.ListingId == listing.ListingId)
                    .Select(b => (decimal?)b.BidAmount)
                    .Max() ?? listing.StartingBid,
                StartTime = listing.StartTime,
                EndTime = listing.EndTime,
                TenderStatusName = tenderStatus != null ? tenderStatus.StatusName : "N/A",
                IsActive = listing.IsActive,
                BidCount = bidCount,
                HasBids = bidCount > 0
            };
    }

    /// <summary>
    /// Retrieves pending tender listings awaiting review.
    /// </summary>
    public static IQueryable<TenderListItemResponse> Pending(Asset_Tender_DBContext db)
    {
        return ProjectListings(db).Where(t =>
            t.TenderStatusName == UserConstants.TenderStatusPending &&
            t.AssetStatusName == UserConstants.AssetStatusPending);
    }

    /// <summary>
    /// Retrieves active, currently open tender listings for staff viewing.
    /// </summary>
    public static IQueryable<TenderListItemResponse> LiveForStaff(Asset_Tender_DBContext db)
    {
        var now = DateTime.Now;

        return ProjectListings(db).Where(t =>
            t.IsActive &&
            t.TenderStatusName == UserConstants.TenderStatusOpen &&
            t.AssetStatusName == UserConstants.AssetStatusActive &&
            t.StartTime <= now &&
            t.EndTime > now);
    }

    public static IQueryable<TenderListItemResponse> ExpiredForAdmin(Asset_Tender_DBContext db)
    {
        var now = DateTime.Now;
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
