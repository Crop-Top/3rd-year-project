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
            join department in db.Departments.AsNoTracking() on asset.DepartmentId equals department.DepartmentId
            join condition in db.AssetConditions.AsNoTracking() on asset.AssetConditionId equals condition.AssetConditionId
            join assetStatus in db.AssetStatuses.AsNoTracking() on asset.AssetStatusId equals assetStatus.AssetStatusId
            join tenderStatus in db.TenderStatuses.AsNoTracking() on listing.TenderStatusId equals tenderStatus.TenderStatusId
            select new TenderListItemResponse
            {
                ListingId = listing.ListingId,
                AssetId = asset.AssetId,
                AssetName = asset.AssetName,
                BarcodeSerial = asset.BarcodeSerial,
                CategoryName = category.CategoryName,
                DepartmentName = department.DepartmentName,
                ConditionName = condition.ConditionName,
                Description = asset.ConditionNotes ?? asset.AssetDescription,
                StartingBid = listing.StartingBid,
                RecommendedPrice = asset.ReccomendedPrice,
                ImageUrl = asset.ImageUrl,
                StartTime = listing.StartTime,
                EndTime = listing.EndTime,
                AssetStatusName = assetStatus.StatusName,
                TenderStatusName = tenderStatus.StatusName,
                IsActive = listing.IsActive
            };
    }

    public static IQueryable<TenderListItemResponse> Pending(Asset_Tender_DBContext db) =>
        ProjectListings(db).Where(t =>
            t.TenderStatusName == UserConstants.TenderStatusPending &&
            t.AssetStatusName == UserConstants.AssetStatusPending);

    public static IQueryable<TenderListItemResponse> LiveForStaff(Asset_Tender_DBContext db) =>
        ProjectListings(db).Where(t =>
            t.IsActive &&
            t.TenderStatusName == UserConstants.TenderStatusOpen &&
            t.AssetStatusName == UserConstants.AssetStatusActive);
}
